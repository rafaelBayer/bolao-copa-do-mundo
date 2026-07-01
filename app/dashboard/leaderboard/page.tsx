import Link from "next/link";
import {
  LeaderboardClient,
  type CombinedLeaderboardEntry,
} from "@/components/leaderboard/LeaderboardClient";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KNOCKOUT_TOURNAMENT_KEY } from "@/lib/knockout/bracketStructure";
import { loadPoolKnockoutRanking } from "@/lib/knockout/loadKnockoutRanking";
import type {
  KnockoutMatch,
  KnockoutRankingEntry,
  KnockoutRound,
} from "@/lib/knockout/types";
import {
  buildLeaderboard,
  hasRealResult,
  type LeaderboardDataRow,
  type LeaderboardEntry,
} from "@/lib/scoring/buildLeaderboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const rounds = [1, 2, 3];

type LiveLeaderboardDataRow = LeaderboardDataRow & {
  is_live_match?: boolean | null;
  live_matches_count?: number | null;
};
type RoundHighlight = {
  title: string;
  name: string;
  detail: string;
};
type RoundHighlights = {
  star?: RoundHighlight;
  exact?: RoundHighlight;
  climber?: RoundHighlight;
};
type LeaderboardPageProps = {
  searchParams?: Promise<{
    pool?: string | string[];
  }>;
};
type PoolSummary = {
  id: string;
  name: string;
  isDefault: boolean;
};

const previewRows = [
  { position: 1, name: "Participante", points: 18 },
  { position: 2, name: "Participante", points: 15 },
  { position: 3, name: "Participante", points: 13 },
  { position: 4, name: "Participante", points: 10 },
  { position: 5, name: "Participante", points: 8 },
];

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapPoolSummary(row: Record<string, unknown>): PoolSummary | null {
  const pool = single(
    row.pools as Record<string, unknown> | Record<string, unknown>[] | null,
  );

  if (!pool?.id) {
    return null;
  }

  return {
    id: String(pool.id),
    name: typeof pool.name === "string" ? pool.name : "Meu bolão",
    isDefault: pool.is_default === true,
  };
}

function sortPools(pools: PoolSummary[]) {
  return [...pools].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
}

function rowsUntilRound(rows: LeaderboardDataRow[], round: number) {
  return rows.filter(
    (row) => row.round_number !== null && row.round_number <= round,
  );
}

function namesLabel(entries: Array<{ name: string }>) {
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0].name;
  if (entries.length === 2) return `${entries[0].name} e ${entries[1].name}`;

  return `${entries[0].name} +${entries.length - 1}`;
}

function buildRoundHighlights(
  rows: LeaderboardDataRow[],
  round: number,
): RoundHighlights {
  const roundEntries = buildLeaderboard(rows, round);
  const star = roundEntries.find((entry) => entry.totalPoints > 0);
  const maxExactScores = Math.max(
    0,
    ...roundEntries.map((entry) => entry.exactScores),
  );
  const exactWinners =
    maxExactScores > 0
      ? roundEntries.filter((entry) => entry.exactScores === maxExactScores)
      : [];
  const previousRows = rowsUntilRound(rows, round - 1);
  const currentRows = rowsUntilRound(rows, round);
  const previousEntries = buildLeaderboard(previousRows);
  const currentEntries = buildLeaderboard(currentRows);
  const previousPositions = new Map(
    previousEntries.map((entry) => [entry.userId, entry.position]),
  );
  const climber =
    round > 1 && hasRealResult(previousRows) && hasRealResult(currentRows)
      ? currentEntries
          .map((entry) => ({
            entry,
            climb:
              (previousPositions.get(entry.userId) ?? entry.position) -
              entry.position,
          }))
          .filter((item) => item.climb > 0)
          .sort((left, right) => {
            if (right.climb !== left.climb) return right.climb - left.climb;

            return left.entry.position - right.entry.position;
          })[0]
      : null;

  return {
    star: star
      ? {
          title: `Craque da Rodada ${round}`,
          name: star.name,
          detail: `${star.totalPoints} pontos, ${star.exactScores} placares exatos`,
        }
      : undefined,
    exact:
      exactWinners.length > 0
        ? {
            title: "Rei dos placares",
            name: namesLabel(exactWinners),
            detail: `${maxExactScores} ${
              maxExactScores === 1 ? "placar exato" : "placares exatos"
            }`,
          }
        : undefined,
    climber: climber
      ? {
          title: "Maior subida",
          name: climber.entry.name,
          detail: `Subiu ${climber.climb} ${
            climber.climb === 1 ? "posição" : "posições"
          }`,
        }
      : undefined,
  };
}

function mapKnockoutMatchRow(value: unknown): KnockoutMatch {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    tournamentKey: String(row.tournament_key),
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    externalMatchId:
      typeof row.external_match_id === "string" ? row.external_match_id : null,
    teamASource:
      typeof row.team_a_source === "string" ? row.team_a_source : null,
    teamA: typeof row.team_a === "string" ? row.team_a : null,
    teamACode: typeof row.team_a_code === "string" ? row.team_a_code : null,
    teamAFlagUrl:
      typeof row.team_a_flag_url === "string" ? row.team_a_flag_url : null,
    teamBSource:
      typeof row.team_b_source === "string" ? row.team_b_source : null,
    teamB: typeof row.team_b === "string" ? row.team_b : null,
    teamBCode: typeof row.team_b_code === "string" ? row.team_b_code : null,
    teamBFlagUrl:
      typeof row.team_b_flag_url === "string" ? row.team_b_flag_url : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    lockAt: null,
    statusShort:
      typeof row.status_short === "string" ? row.status_short : null,
    statusLong: typeof row.status_long === "string" ? row.status_long : null,
    elapsed: typeof row.elapsed === "number" ? row.elapsed : null,
    homeScoreLive:
      typeof row.home_score_live === "number" ? row.home_score_live : null,
    awayScoreLive:
      typeof row.away_score_live === "number" ? row.away_score_live : null,
    homeScore: typeof row.home_score === "number" ? row.home_score : null,
    awayScore: typeof row.away_score === "number" ? row.away_score : null,
    scoreUpdatedAt:
      typeof row.score_updated_at === "string" ? row.score_updated_at : null,
    isLocked: true,
    canPick: false,
    userPick: null,
    pointsIfCorrect: 2,
    isFinished: typeof row.winner_team === "string",
    isPickCorrect: null,
    pickPoints: 0,
    winnerTeam: typeof row.winner_team === "string" ? row.winner_team : null,
    winnerTeamCode:
      typeof row.winner_team_code === "string" ? row.winner_team_code : null,
  };
}

function sortCombinedEntries(entries: CombinedLeaderboardEntry[]) {
  return [...entries]
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.knockoutPoints !== left.knockoutPoints) {
        return right.knockoutPoints - left.knockoutPoints;
      }

      if (right.groupPoints !== left.groupPoints) {
        return right.groupPoints - left.groupPoints;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

function combineRankings(
  groupEntries: LeaderboardEntry[],
  knockoutEntries: KnockoutRankingEntry[],
) {
  const knockoutByUserId = new Map(
    knockoutEntries.map((entry) => [entry.userId, entry]),
  );
  const userIds = new Set([
    ...groupEntries.map((entry) => entry.userId),
    ...knockoutEntries.map((entry) => entry.userId),
  ]);
  const combined = Array.from(userIds).map((userId) => {
    const groupEntry = groupEntries.find((entry) => entry.userId === userId);
    const knockoutEntry = knockoutByUserId.get(userId);
    const name = groupEntry?.name ?? knockoutEntry?.name ?? "Participante";

    return {
      position: 0,
      userId,
      name,
      username: groupEntry?.username ?? knockoutEntry?.username ?? null,
      avatarUrl: groupEntry?.avatarUrl ?? knockoutEntry?.avatarUrl ?? null,
      totalPoints:
        (groupEntry?.totalPoints ?? 0) + (knockoutEntry?.totalPoints ?? 0),
      exactScores: groupEntry?.exactScores ?? 0,
      correctResults: groupEntry?.correctResults ?? 0,
      scoredMatches: groupEntry?.scoredMatches ?? 0,
      filledPredictions: groupEntry?.filledPredictions ?? 0,
      groupPoints: groupEntry?.totalPoints ?? 0,
      knockoutPoints: knockoutEntry?.totalPoints ?? 0,
      knockoutCorrectPicks: knockoutEntry?.correctPicks ?? 0,
      knockoutPicksCount: knockoutEntry?.picksCount ?? 0,
      knockoutComplete: knockoutEntry?.isComplete ?? false,
      knockoutUpdatedAt:
        knockoutEntry?.completedAt ?? knockoutEntry?.submittedAt ?? null,
    } satisfies CombinedLeaderboardEntry;
  });
  const knockoutTableEntries = knockoutEntries.map((entry) => ({
    position: 0,
    userId: entry.userId,
    name: entry.name,
    username: entry.username,
    avatarUrl: entry.avatarUrl,
    totalPoints: entry.totalPoints,
    exactScores: 0,
    correctResults: 0,
    scoredMatches: entry.correctPicks,
    filledPredictions: entry.picksCount,
    groupPoints: 0,
    knockoutPoints: entry.totalPoints,
    knockoutCorrectPicks: entry.correctPicks,
    knockoutPicksCount: entry.picksCount,
    knockoutComplete: entry.isComplete,
    knockoutUpdatedAt: entry.completedAt ?? entry.submittedAt,
  } satisfies CombinedLeaderboardEntry));

  return {
    overallEntries: sortCombinedEntries(combined),
    knockoutTableEntries: sortCombinedEntries(knockoutTableEntries),
  };
}

function PublicLeaderboardLocked() {
  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
      <div className="space-y-5">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300 light:text-emerald-700">
            Bolão Geral
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-50 light:text-slate-950">
            Classificação
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 light:text-slate-500">
            Acompanhe sua posição no ranking depois de criar sua conta.
          </p>
        </section>

        <Card className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none select-none blur-sm">
            <div className="mb-4 flex flex-wrap gap-2">
              {["Geral", "Grupos", "Mata-mata", "Por rodada", "Ao vivo"].map(
                (item, index) => (
                  <span
                    key={item}
                    className={`rounded-lg px-3 py-2 text-sm font-bold ${
                      index === 0
                        ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
                        : "bg-slate-950/45 text-slate-400 light:bg-slate-50 light:text-slate-500"
                    }`}
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 light:border-slate-200">
              {previewRows.map((row) => (
                <div
                  key={row.position}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-slate-800/70 px-4 py-4 last:border-b-0 light:border-slate-200/80"
                >
                  <span className="text-lg font-black text-slate-50 light:text-slate-950">
                    {row.position}
                  </span>
                  <span className="font-bold text-slate-100 light:text-slate-800">
                    {row.name}
                  </span>
                  <span className="text-right font-black text-emerald-300 light:text-emerald-700">
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px] light:bg-white/75">
            <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center shadow-2xl light:border-slate-200 light:bg-white">
              <Badge tone="emerald">Ranking</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
                Crie sua conta para ver a classificação
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400 light:text-slate-600">
                Entre no bolão, registre seus palpites e acompanhe sua posição no ranking.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/login?redirectTo=%2Fdashboard%2Fleaderboard"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro?redirectTo=%2Fdashboard%2Fleaderboard"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
                >
                  Criar conta
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const requestedPoolId = Array.isArray(resolvedSearchParams?.pool)
    ? resolvedSearchParams?.pool[0]
    : resolvedSearchParams?.pool;
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return <PublicLeaderboardLocked />;
  }

  const { data: membershipsData } = await supabase
    .from("pool_members")
    .select("pool_id, pools(id, name, is_default)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const pools = sortPools(
    (membershipsData ?? [])
      .map((row) => mapPoolSummary(row as Record<string, unknown>))
      .filter((pool): pool is PoolSummary => Boolean(pool)),
  );
  const selectedPool =
    pools.find((pool) => pool.id === requestedPoolId) ?? pools[0] ?? null;

  if (requestedPoolId && !pools.some((pool) => pool.id === requestedPoolId)) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Acesso negado</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Bolão não encontrado
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Esse bolão não existe ou você não tem permissão para ver a classificação.
          </p>
        </Card>
      </main>
    );
  }

  if (!selectedPool) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolão</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Classificação
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite válido para entrar em um bolão.
          </p>
        </Card>
      </main>
    );
  }

  const [
    { data, error },
    { data: liveData, error: liveError },
    { data: knockoutMatchData, error: knockoutMatchesError },
  ] =
    await Promise.all([
      supabase.rpc("get_pool_leaderboard_data", {
        target_pool_id: selectedPool.id,
      }),
      supabase.rpc("get_pool_live_leaderboard_data", {
        target_pool_id: selectedPool.id,
      }),
      supabase
        .from("knockout_matches")
        .select(
          [
            "id",
            "tournament_key",
            "round",
            "position",
            "external_match_id",
            "team_a_source",
            "team_a",
            "team_a_code",
            "team_a_flag_url",
            "team_b_source",
            "team_b",
            "team_b_code",
            "team_b_flag_url",
            "starts_at",
            "status_short",
            "status_long",
            "elapsed",
            "home_score_live",
            "away_score_live",
            "home_score",
            "away_score",
            "score_updated_at",
            "winner_team",
            "winner_team_code",
          ].join(", "),
        )
        .eq("tournament_key", KNOCKOUT_TOURNAMENT_KEY),
    ]);
  const rows = (data ?? []) as LeaderboardDataRow[];
  const liveRows = (liveData ?? []) as LiveLeaderboardDataRow[];
  const groupEntries = buildLeaderboard(rows);
  const knockoutMatches = Array.isArray(knockoutMatchData)
    ? (knockoutMatchData as unknown[]).map(mapKnockoutMatchRow)
    : [];
  const { entries: knockoutEntries, error: knockoutRankingError } =
    await loadPoolKnockoutRanking({
      poolId: selectedPool.id,
      tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
      matches: knockoutMatches,
    });
  const { overallEntries, knockoutTableEntries } = combineRankings(
    groupEntries,
    knockoutEntries,
  );
  const liveMatchesCount = liveRows[0]?.live_matches_count ?? 0;
  const roundLeaderboards = Object.fromEntries(
    rounds.map((round) => [
      round,
      {
        entries: buildLeaderboard(rows, round),
        hasResult: hasRealResult(rows, round),
      },
    ]),
  );
  const roundHighlights = Object.fromEntries(
    rounds.map((round) => [round, buildRoundHighlights(rows, round)]),
  );

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
      {pools.length > 1 ? (
        <Card className="mb-5 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
              Classificação por bolão
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Escolha qual grupo de participantes você quer comparar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pools.map((pool) => {
              const isSelected = pool.id === selectedPool.id;

              return (
                <Link
                  key={pool.id}
                  href={`/dashboard/leaderboard?pool=${pool.id}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 light:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700"
                      : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-slate-50 light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700"
                  }`}
                >
                  {pool.name}
                </Link>
              );
            })}
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Erro</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Não foi possível carregar a classificação agora.
          </p>
        </Card>
      ) : null}

      {liveError ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Ao vivo</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Não foi possível carregar a classificação ao vivo agora.
          </p>
        </Card>
      ) : null}

      {knockoutMatchesError || knockoutRankingError ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Mata-mata</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Não foi possível carregar a pontuação do mata-mata agora.
          </p>
        </Card>
      ) : null}

      <LeaderboardClient
        poolId={selectedPool.id}
        poolName={selectedPool.name}
        overallEntries={overallEntries}
        groupEntries={groupEntries}
        knockoutEntries={knockoutTableEntries}
        hasGroupResult={hasRealResult(rows)}
        hasKnockoutResult={knockoutEntries.some(
          (entry) => entry.totalPoints > 0,
        )}
        roundLeaderboards={roundLeaderboards}
        roundHighlights={roundHighlights}
        liveEntries={buildLeaderboard(liveRows)}
        hasLiveResult={hasRealResult(liveRows)}
        liveMatchesCount={liveMatchesCount}
      />
    </main>
  );
}
