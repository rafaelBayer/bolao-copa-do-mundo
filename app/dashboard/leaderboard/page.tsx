import Link from "next/link";
import {
  LeaderboardClient,
  type CombinedLeaderboardEntry,
} from "@/components/leaderboard/LeaderboardClient";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KNOCKOUT_TOURNAMENT_KEY } from "@/lib/knockout/bracketStructure";
import type { KnockoutRankingEntry } from "@/lib/knockout/types";
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
    name: typeof pool.name === "string" ? pool.name : "Meu bolao",
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
            climber.climb === 1 ? "posicao" : "posicoes"
          }`,
        }
      : undefined,
  };
}

function mapKnockoutRankingEntry(value: unknown): KnockoutRankingEntry {
  const row = value as Record<string, unknown>;
  const fallbackName =
    typeof row.username === "string" ? row.username : "Participante";

  return {
    userId: String(row.user_id),
    name:
      typeof row.profile_name === "string" && row.profile_name.trim()
        ? row.profile_name
        : fallbackName,
    username: typeof row.username === "string" ? row.username : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    totalPoints:
      typeof row.total_points === "number" ? row.total_points : 0,
    correctPicks:
      typeof row.correct_picks === "number" ? row.correct_picks : 0,
    submittedAt:
      typeof row.submitted_at === "string" ? row.submitted_at : null,
    completedAt:
      typeof row.completed_at === "string" ? row.completed_at : null,
    picksCount: typeof row.picks_count === "number" ? row.picks_count : 0,
    isComplete: row.is_complete === true,
    roundOf32Points:
      typeof row.round_of_32_points === "number" ? row.round_of_32_points : 0,
    roundOf16Points:
      typeof row.round_of_16_points === "number" ? row.round_of_16_points : 0,
    quarterfinalPoints:
      typeof row.quarterfinal_points === "number" ? row.quarterfinal_points : 0,
    semifinalPoints:
      typeof row.semifinal_points === "number" ? row.semifinal_points : 0,
    finalPoints:
      typeof row.final_points === "number" ? row.final_points : 0,
    roundOf32Correct:
      typeof row.round_of_32_correct === "number" ? row.round_of_32_correct : 0,
    roundOf16Correct:
      typeof row.round_of_16_correct === "number" ? row.round_of_16_correct : 0,
    quarterfinalCorrect:
      typeof row.quarterfinal_correct === "number" ? row.quarterfinal_correct : 0,
    semifinalCorrect:
      typeof row.semifinal_correct === "number" ? row.semifinal_correct : 0,
    finalCorrect:
      typeof row.final_correct === "number" ? row.final_correct : 0,
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
    return null;
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
            Bolao nao encontrado
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Esse bolao nao existe ou voce nao tem permissao para ver a classificacao.
          </p>
        </Card>
      </main>
    );
  }

  if (!selectedPool) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolao</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Classificacao
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite valido para entrar em um bolao.
          </p>
        </Card>
      </main>
    );
  }

  const [
    { data, error },
    { data: liveData, error: liveError },
    { data: knockoutRankingData, error: knockoutRankingError },
  ] =
    await Promise.all([
      supabase.rpc("get_pool_leaderboard_data", {
        target_pool_id: selectedPool.id,
      }),
      supabase.rpc("get_pool_live_leaderboard_data", {
        target_pool_id: selectedPool.id,
      }),
      supabase.rpc("get_pool_knockout_ranking", {
        target_pool_id: selectedPool.id,
        target_tournament_key: KNOCKOUT_TOURNAMENT_KEY,
      }),
    ]);
  const rows = (data ?? []) as LeaderboardDataRow[];
  const liveRows = (liveData ?? []) as LiveLeaderboardDataRow[];
  const groupEntries = buildLeaderboard(rows);
  const knockoutEntries = Array.isArray(knockoutRankingData)
    ? (knockoutRankingData as unknown[]).map(mapKnockoutRankingEntry)
    : [];
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
              Classificacao por bolao
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Escolha qual grupo de participantes voce quer comparar.
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
            Nao foi possivel carregar a classificacao agora.
          </p>
        </Card>
      ) : null}

      {liveError ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Ao vivo</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Nao foi possivel carregar a classificacao ao vivo agora.
          </p>
        </Card>
      ) : null}

      {knockoutRankingError ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Mata-mata</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Nao foi possivel carregar a pontuacao do mata-mata agora.
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
