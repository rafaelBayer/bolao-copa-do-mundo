import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KnockoutBracket } from "@/components/knockout/KnockoutBracket";
import {
  KNOCKOUT_TOURNAMENT_KEY,
} from "@/lib/knockout/buildBracket";
import { loadCommunityPicks } from "@/lib/knockout/loadCommunityPicks";
import { loadPoolKnockoutRanking } from "@/lib/knockout/loadKnockoutRanking";
import { isKnockoutMatchPickLocked } from "@/lib/knockout/pickLock";
import type {
  KnockoutMatch,
  KnockoutCommunityPicksSummary,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MataMataPageProps = {
  searchParams?: Promise<{
    pool?: string | string[];
  }>;
};
type PoolSummary = {
  id: string;
  name: string;
  isDefault: boolean;
};
type KnockoutLiveScoreFields = Pick<
  KnockoutMatch,
  | "statusShort"
  | "statusLong"
  | "elapsed"
  | "homeScoreLive"
  | "awayScoreLive"
  | "homeScore"
  | "awayScore"
  | "scoreUpdatedAt"
>;

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
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

function mapSettings(value: unknown): KnockoutSettings {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    tournamentKey: String(row.tournamentKey),
    name: typeof row.name === "string" ? row.name : "Copa do Mundo 2026",
    deadlineAt: String(row.deadlineAt),
    isActive: row.isActive === true,
  };
}

function mapMatch(value: unknown): KnockoutMatch {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    tournamentKey: String(row.tournamentKey),
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    externalMatchId:
      typeof row.externalMatchId === "string" ? row.externalMatchId : null,
    teamASource: typeof row.teamASource === "string" ? row.teamASource : null,
    teamA: typeof row.teamA === "string" ? row.teamA : null,
    teamACode: typeof row.teamACode === "string" ? row.teamACode : null,
    teamAFlagUrl: typeof row.teamAFlagUrl === "string" ? row.teamAFlagUrl : null,
    teamBSource: typeof row.teamBSource === "string" ? row.teamBSource : null,
    teamB: typeof row.teamB === "string" ? row.teamB : null,
    teamBCode: typeof row.teamBCode === "string" ? row.teamBCode : null,
    teamBFlagUrl: typeof row.teamBFlagUrl === "string" ? row.teamBFlagUrl : null,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    lockAt: typeof row.lockAt === "string" ? row.lockAt : null,
    statusShort: typeof row.statusShort === "string" ? row.statusShort : null,
    statusLong: typeof row.statusLong === "string" ? row.statusLong : null,
    elapsed: typeof row.elapsed === "number" ? row.elapsed : null,
    homeScoreLive:
      typeof row.homeScoreLive === "number" ? row.homeScoreLive : null,
    awayScoreLive:
      typeof row.awayScoreLive === "number" ? row.awayScoreLive : null,
    homeScore: typeof row.homeScore === "number" ? row.homeScore : null,
    awayScore: typeof row.awayScore === "number" ? row.awayScore : null,
    scoreUpdatedAt:
      typeof row.scoreUpdatedAt === "string" ? row.scoreUpdatedAt : null,
    isLocked: row.isLocked === true,
    canPick: row.canPick === true,
    userPick: typeof row.userPick === "string" ? row.userPick : null,
    pointsIfCorrect:
      typeof row.pointsIfCorrect === "number" ? row.pointsIfCorrect : 0,
    isFinished: row.isFinished === true,
    isPickCorrect:
      typeof row.isPickCorrect === "boolean" ? row.isPickCorrect : null,
    pickPoints: typeof row.pickPoints === "number" ? row.pickPoints : 0,
    winnerTeam: typeof row.winnerTeam === "string" ? row.winnerTeam : null,
    winnerTeamCode:
      typeof row.winnerTeamCode === "string" ? row.winnerTeamCode : null,
  };
}

function mapSettingsRow(row: Record<string, unknown>): KnockoutSettings {
  return {
    id: String(row.id),
    tournamentKey: String(row.tournament_key),
    name: typeof row.name === "string" ? row.name : "Copa do Mundo 2026",
    deadlineAt:
      typeof row.deadline_at === "string" ? row.deadline_at : new Date(0).toISOString(),
    isActive: row.is_active === true,
  };
}

function lockAtFromStartsAt(startsAt: string | null) {
  if (!startsAt) {
    return null;
  }

  const startsAtTime = new Date(startsAt).getTime();

  if (!Number.isFinite(startsAtTime)) {
    return null;
  }

  return new Date(startsAtTime - 10 * 60 * 1000).toISOString();
}

function mapLiveScoreFields(row: Record<string, unknown>): KnockoutLiveScoreFields {
  return {
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
  };
}

function mapMatchRow(row: Record<string, unknown>): KnockoutMatch {
  const startsAt = typeof row.starts_at === "string" ? row.starts_at : null;
  const baseMatch = {
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
    startsAt,
    lockAt: lockAtFromStartsAt(startsAt),
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
    userPick: null,
    pointsIfCorrect: 2,
    isPickCorrect: null,
    pickPoints: 0,
    winnerTeam: typeof row.winner_team === "string" ? row.winner_team : null,
    winnerTeamCode:
      typeof row.winner_team_code === "string" ? row.winner_team_code : null,
  };
  const isLocked = isKnockoutMatchPickLocked(baseMatch);
  const hasTeams = Boolean(baseMatch.teamA && baseMatch.teamB);

  return {
    ...baseMatch,
    isLocked,
    canPick: hasTeams && !isLocked,
    isFinished: Boolean(baseMatch.winnerTeam),
  };
}

async function enrichMatchesWithLiveScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matches: KnockoutMatch[],
) {
  const externalMatchIds = Array.from(
    new Set(
      matches
        .map((match) => match.externalMatchId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (externalMatchIds.length === 0) {
    return matches;
  }

  const { data, error } = await supabase
    .from("knockout_matches")
    .select(
      "external_match_id, status_short, status_long, elapsed, home_score_live, away_score_live, home_score, away_score, score_updated_at",
    )
    .in("external_match_id", externalMatchIds);

  if (error || !data) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to load knockout live score fields", error);
    }

    return matches;
  }

  const liveScoreByExternalMatchId = new Map(
    (data as Record<string, unknown>[])
      .filter((row) => typeof row.external_match_id === "string")
      .map((row) => [
        String(row.external_match_id),
        mapLiveScoreFields(row),
      ]),
  );

  return matches.map((match) => {
    const liveScore =
      match.externalMatchId ?
        liveScoreByExternalMatchId.get(match.externalMatchId)
      : null;

    return liveScore ? { ...match, ...liveScore } : match;
  });
}

function mapBracket(value: unknown): UserKnockoutBracket | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    userId: String(row.userId),
    tournamentKey: String(row.tournamentKey),
    submittedAt: typeof row.submittedAt === "string" ? row.submittedAt : null,
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapPick(value: unknown): KnockoutPick {
  const row = value as Record<string, unknown>;

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    selectedTeam:
      typeof row.selectedTeam === "string" ? row.selectedTeam : "",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

function UnavailableKnockoutMessage() {
  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="p-6">
        <Badge tone="amber">Mata-mata</Badge>
        <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
          O mata-mata ainda não está disponível.
        </h1>
        <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
          Assim que os confrontos forem definidos, você poderá palpitar nos jogos oficiais.
        </p>
      </Card>
    </main>
  );
}

function LoadErrorMessage() {
  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="p-6">
        <Badge tone="amber">Mata-mata</Badge>
        <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
          Não foi possível carregar o mata-mata agora.
        </h1>
        <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
          Tente novamente em alguns instantes.
        </p>
      </Card>
    </main>
  );
}

function logKnockoutStateError(error: unknown) {
  const serializeError = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return String(value);
    }

    const record = value as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    for (const key of Object.getOwnPropertyNames(value)) {
      payload[key] = record[key];
    }

    for (const key of ["code", "message", "details", "hint", "name", "stack"]) {
      if (!(key in payload) && key in record) {
        payload[key] = record[key];
      }
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return String(value);
    }
  };

  if (error instanceof Error) {
    console.error("Failed to load knockout state", serializeError({
      name: error.name,
      message: error.message,
      stack: error.stack,
    }));
    return;
  }

  console.error("Failed to load knockout state", serializeError(error));
}

export default async function MataMataPage({ searchParams }: MataMataPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const requestedPoolId = Array.isArray(resolvedSearchParams?.pool)
    ? resolvedSearchParams?.pool[0]
    : resolvedSearchParams?.pool;
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const isAuthenticated = Boolean(userId);
  const dataClient = isAuthenticated ? supabase : createAdminClient();
  const { data: membershipsData } = isAuthenticated
    ? await supabase
        .from("pool_members")
        .select("pool_id, pools(id, name, is_default)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
    : { data: [] };
  const pools = sortPools(
    (membershipsData ?? [])
      .map((row) => mapPoolSummary(row as Record<string, unknown>))
      .filter((pool): pool is PoolSummary => Boolean(pool)),
  );
  const { data: publicPoolData } = !isAuthenticated
    ? requestedPoolId
      ? await dataClient
          .from("pools")
          .select("id, name, type, is_default")
          .eq("id", requestedPoolId)
          .maybeSingle()
      : await dataClient
          .from("pools")
          .select("id, name, type, is_default")
          .eq("is_default", true)
          .maybeSingle()
    : { data: null };
  const publicPool =
    publicPoolData?.type === "general" && publicPoolData.is_default === true
      ? {
          id: String(publicPoolData.id),
          name:
            typeof publicPoolData.name === "string"
              ? publicPoolData.name
              : "Bolão Geral",
          isDefault: true,
        }
      : null;
  const visiblePools = isAuthenticated ? pools : publicPool ? [publicPool] : [];
  const selectedPool = isAuthenticated
    ? pools.find((pool) => pool.id === requestedPoolId) ?? pools[0] ?? null
    : publicPool;

  if (requestedPoolId && !visiblePools.some((pool) => pool.id === requestedPoolId)) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Acesso negado</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Bolão não encontrado
          </h1>
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
            Mata-mata
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite válido para entrar em um bolão.
          </p>
        </Card>
      </main>
    );
  }

  let settings: KnockoutSettings;
  let matches: KnockoutMatch[];
  let bracket: UserKnockoutBracket | null = null;
  let picks: KnockoutPick[] = [];
  let rankingEntries: KnockoutRankingEntry[] = [];
  let rankingError = false;
  let communityPicks = new Map<string, KnockoutCommunityPicksSummary>();
  let communityPicksError = false;
  let availableMatchesCount = 0;
  let openPicksCount = 0;
  let submittedOpenPicksCount = 0;
  let missingOpenPicksCount = 0;
  let nextLockAt: string | null = null;

  if (isAuthenticated) {
    const { data: stateData, error: stateError } = await supabase.rpc(
      "get_knockout_state",
      {
        target_tournament_key: KNOCKOUT_TOURNAMENT_KEY,
      },
    );

    if (stateError) {
      if (
        stateError.code === "P0001" &&
        stateError.message?.toLowerCase().includes("not found")
      ) {
        return <UnavailableKnockoutMessage />;
      }

      if (process.env.NODE_ENV !== "production") {
        logKnockoutStateError(stateError);
      }

      return <LoadErrorMessage />;
    }

    const stateRow = single(stateData as Record<string, unknown>[] | null);
    if (!stateRow) {
      return <UnavailableKnockoutMessage />;
    }

    settings = mapSettings(stateRow.settings);
    const rawMatches = Array.isArray(stateRow.matches)
      ? (stateRow.matches as unknown[]).map(mapMatch)
      : [];
    matches = await enrichMatchesWithLiveScores(supabase, rawMatches);
    const rankingResult = await loadPoolKnockoutRanking({
      poolId: selectedPool.id,
      tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
      matches,
    });
    const communityResult = await loadCommunityPicks({
      poolId: selectedPool.id,
      tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
      currentUserId: userId ?? "",
      matches,
    });

    rankingEntries = rankingResult.entries;
    rankingError = Boolean(rankingResult.error);
    communityPicks = communityResult.summaries;
    communityPicksError = Boolean(communityResult.error);
    bracket = mapBracket(stateRow.bracket);
    picks = Array.isArray(stateRow.picks)
      ? (stateRow.picks as unknown[]).map(mapPick)
      : [];
    availableMatchesCount =
      typeof stateRow.available_matches_count === "number"
        ? stateRow.available_matches_count
        : 0;
    openPicksCount =
      typeof stateRow.open_picks_count === "number"
        ? stateRow.open_picks_count
        : 0;
    submittedOpenPicksCount =
      typeof stateRow.submitted_open_picks_count === "number"
        ? stateRow.submitted_open_picks_count
        : 0;
    missingOpenPicksCount =
      typeof stateRow.missing_open_picks_count === "number"
        ? stateRow.missing_open_picks_count
        : 0;
    nextLockAt =
      typeof stateRow.next_lock_at === "string" ? stateRow.next_lock_at : null;
  } else {
    const [{ data: settingsRow }, { data: matchRows, error: matchesError }] =
      await Promise.all([
        dataClient
          .from("knockout_settings")
          .select("id, tournament_key, name, deadline_at, is_active")
          .eq("tournament_key", KNOCKOUT_TOURNAMENT_KEY)
          .maybeSingle(),
        dataClient
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

    if (!settingsRow) {
      return <UnavailableKnockoutMessage />;
    }

    if (matchesError || !matchRows) {
      return <LoadErrorMessage />;
    }

    settings = mapSettingsRow(settingsRow as Record<string, unknown>);
    matches = (matchRows as unknown as Record<string, unknown>[]).map(mapMatchRow);
    const communityResult = selectedPool.id
      ? await loadCommunityPicks({
          poolId: selectedPool.id,
          tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
          currentUserId: "",
          matches,
        })
      : {
          summaries: new Map(),
          error: null,
        };
    const openMatches = matches.filter((match) => match.canPick);

    communityPicks = communityResult.summaries;
    communityPicksError = Boolean(communityResult.error);
    availableMatchesCount = matches.filter(
      (match) => match.teamA && match.teamB,
    ).length;
    openPicksCount = openMatches.length;
    missingOpenPicksCount = openMatches.length;
    nextLockAt = openMatches
      .map((match) => match.lockAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;
  }

  if (
    matches.filter((match) => match.round === "round_of_32").length < 16
  ) {
    return <UnavailableKnockoutMessage />;
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
      {isAuthenticated && visiblePools.length > 1 ? (
        <Card className="mb-5 p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
            Ranking por bolão
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {visiblePools.map((pool) => {
              const isSelected = pool.id === selectedPool.id;

              return (
                <Link
                  key={pool.id}
                  href={`/dashboard/mata-mata?pool=${pool.id}`}
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

      <KnockoutBracket
        tournamentKey={KNOCKOUT_TOURNAMENT_KEY}
        settings={settings}
        matches={matches}
        initialBracket={bracket}
        initialPicks={picks}
        rankingEntries={rankingEntries}
        rankingError={rankingError ? true : false}
        communityPicksByMatchKey={Object.fromEntries(communityPicks)}
        communityPicksError={communityPicksError ? true : false}
        isAuthenticated={isAuthenticated}
        availableMatchesCount={availableMatchesCount}
        openPicksCount={openPicksCount}
        submittedOpenPicksCount={submittedOpenPicksCount}
        missingOpenPicksCount={missingOpenPicksCount}
        nextLockLabel={
          formatDateTime(nextLockAt) ?? "Sem jogos abertos"
        }
        submittedAtLabel={formatDateTime(bracket?.submittedAt)}
      />
    </main>
  );
}
