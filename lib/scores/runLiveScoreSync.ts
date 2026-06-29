import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchApiFootballFixturesByDate } from "@/lib/scores/providers/apiFootball";
import { fetchFootballDataMatchesByMatchdays } from "@/lib/scores/providers/footballData";
import type { LiveScoreFixture } from "@/lib/scores/providers/types";
import {
  espnTeamsMatch,
  espnStatusDebugLabel,
  extractEspnGoals,
  fetchEspnScoreboardByDate,
  fetchEspnSummaryByEventId,
  getEspnWinner,
  mapEspnEventToInternalMatch,
  type EspnEvent,
  type EspnGoal,
} from "@/lib/scores/providers/espn";
import {
  fetchWorldcup26GameByMongoId,
  fetchWorldcup26Games,
  mapWorldcup26GameToInternalScore,
  worldcup26TeamsMatch,
} from "@/lib/scores/providers/worldcup26";
import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";
import {
  isScoreDryRunEnabled,
  logScoreSupabaseTarget,
  logScoreSupabaseTargets,
  resolveScoreSupabaseEnvs,
  type ScoreSupabaseConfig,
} from "@/lib/scores/resolveScoreSupabaseEnv";

const TIMEZONE = "America/Sao_Paulo";
const ACTIVE_WINDOW_BEFORE_MINUTES = 5;
const ESPN_ACTIVE_WINDOW_BEFORE_MINUTES = 60;
const ACTIVE_WINDOW_AFTER_MINUTES = 240;
const HALFTIME_PAUSE_MINUTES = 15;
const MAX_ERROR_MESSAGE_LENGTH = 500;
const MAX_ESTIMATED_ELAPSED_MINUTES = 130;
const MAX_HALFTIME_WALL_CLOCK_MINUTES = 75;

type Worldcup26Games = Awaited<ReturnType<typeof fetchWorldcup26Games>>;
type Worldcup26Game = Awaited<ReturnType<typeof fetchWorldcup26GameByMongoId>>;

const providerFixturesCache = new Map<string, Promise<LiveScoreFixture[]>>();
const worldcup26GamesCache = new Map<string, Promise<Worldcup26Games>>();
const worldcup26GameCache = new Map<string, Promise<Worldcup26Game>>();

function logProviderCacheHit(label: string, cacheKey: string) {
  console.log(`[cache] ${label}: hit (${cacheKey})`);
}

function logProviderCacheMiss(label: string, cacheKey: string) {
  console.log(`[cache] ${label}: miss (${cacheKey})`);
}

type LiveScoreProvider =
  | "api-football"
  | "football-data"
  | "manual"
  | "worldcup26"
  | "espn";
type SyncStatus = "success" | "skipped" | "error";

type SyncDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: Partial<MatchUpdate>;
        Relationships: [];
      };
      knockout_matches: {
        Row: MatchRow;
        Insert: never;
        Update: Partial<MatchUpdate>;
        Relationships: [];
      };
      live_score_sync_logs: {
        Row: never;
        Insert: LiveScoreSyncLogInsert;
        Update: never;
        Relationships: [];
      };
      match_goals: {
        Row: MatchGoalRow;
        Insert: MatchGoalInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type MatchRow = {
  id: string;
  source_table: "matches" | "knockout_matches";
  kickoff_at: string | null;
  round_number: number | null;
  api_football_fixture_id: number | null;
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  status_short: string | null;
  status_long: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  home_score: number | null;
  away_score: number | null;
  score_updated_at: string | null;
  home_team?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  away_team?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
};

type MatchUpdate = {
  status_short: string | null;
  status_long: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  home_score: number | null;
  away_score: number | null;
  score_updated_at: string;
  score_provider?: string | null;
  score_provider_fixture_id?: string | null;
  winner_team?: string | null;
  winner_team_code?: string | null;
};

type LiveScoreSyncLogInsert = {
  provider: string;
  status: SyncStatus;
  reason?: string | null;
  active_matches_count?: number;
  updated_matches_count?: number;
  requested_matchdays?: number[];
  error_message?: string | null;
  started_at: string;
  finished_at?: string | null;
};

type MatchGoalRow = {
  id: string;
  match_id: string;
  provider: string;
  provider_event_id: string | null;
  minute: number | null;
  team_name: string | null;
  player_name: string | null;
};

type MatchGoalInsert = {
  match_id: string;
  provider: string;
  provider_event_id?: string | null;
  minute?: number | null;
  team_name?: string | null;
  team_id?: string | null;
  player_name?: string | null;
  goal_type?: string | null;
  is_penalty?: boolean;
  is_own_goal?: boolean;
  raw_event?: unknown;
};

type SyncSupabaseClient = SupabaseClient<SyncDatabase>;

export type LiveScoreSyncResult = {
  status: "synced" | "skipped" | "error";
  reason: string;
  provider: LiveScoreProvider;
  externalRequests: number;
  updatedMatches: number;
  activeMatches?: number;
  activeMatchdays?: number[];
  liveFixtures?: number;
  nextRecommendedSyncInMinutes?: number;
  nextRecommendedSyncInSeconds?: number;
  message?: string;
};

function currentProvider(): LiveScoreProvider {
  const provider = process.env.LIVE_SCORE_PROVIDER?.trim();

  if (!provider) {
    console.warn("LIVE_SCORE_PROVIDER not defined. Falling back to manual provider.");
    return "manual";
  }

  if (
    provider === "api-football" ||
    provider === "football-data" ||
    provider === "worldcup26" ||
    provider === "espn" ||
    provider === "manual"
  ) {
    return provider;
  }

  console.warn(
    `Invalid LIVE_SCORE_PROVIDER "${provider}". Falling back to manual provider.`,
  );
  return "manual";
}

function createServiceClient(config: ScoreSupabaseConfig): SyncSupabaseClient {
  return createClient<SyncDatabase>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function datePartInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function timePartInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("hour")}:${valueByType.get("minute")}`;
}

function isWithinActiveWindow(
  match: MatchRow,
  now: Date,
  provider: LiveScoreProvider,
) {
  if (!match.kickoff_at) {
    return false;
  }

  const beforeMinutes =
    provider === "espn"
      ? ESPN_ACTIVE_WINDOW_BEFORE_MINUTES
      : ACTIVE_WINDOW_BEFORE_MINUTES;
  const kickoff = new Date(match.kickoff_at);
  const windowStart = new Date(
    kickoff.getTime() - beforeMinutes * 60 * 1000,
  );
  const windowEnd = new Date(
    kickoff.getTime() + ACTIVE_WINDOW_AFTER_MINUTES * 60 * 1000,
  );

  return now >= windowStart && now <= windowEnd;
}

function minutesSince(value: string | null, now: Date) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return (now.getTime() - new Date(value).getTime()) / 60000;
}

function estimatedElapsedFromLocalClock(match: MatchRow, now: Date) {
  if (
    !isLiveMatchStatus(match.status_short) ||
    typeof match.elapsed !== "number" ||
    !match.score_updated_at
  ) {
    return null;
  }

  const elapsedSinceLastUpdate = Math.floor(
    minutesSince(match.score_updated_at, now),
  );

  if (elapsedSinceLastUpdate <= 0) {
    return match.elapsed;
  }

  return Math.min(
    match.elapsed + elapsedSinceLastUpdate,
    MAX_ESTIMATED_ELAPSED_MINUTES,
  );
}

function bestElapsedMinute(
  values: Array<number | null | undefined>,
) {
  const validValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value >= 0,
  );

  if (validValues.length === 0) {
    return null;
  }

  return Math.max(...validValues);
}

function minutesSinceKickoff(match: MatchRow, now: Date) {
  if (!match.kickoff_at) {
    return null;
  }

  return (now.getTime() - new Date(match.kickoff_at).getTime()) / 60000;
}

function isPlausibleCurrentHalftime(match: MatchRow, now: Date) {
  const minutes = minutesSinceKickoff(match, now);

  return (
    minutes !== null &&
    minutes >= 40 &&
    minutes <= MAX_HALFTIME_WALL_CLOCK_MINUTES
  );
}

function syncIntervalForKickoffTimes(kickoffTimesCount: number) {
  if (kickoffTimesCount <= 2) return 3;
  if (kickoffTimesCount === 3) return 4;
  if (kickoffTimesCount === 4) return 5;
  return 7;
}

function worldcup26SyncIntervalInMinutes() {
  const seconds = Number(process.env.SCORES_ACTIVE_SYNC_INTERVAL_SECONDS);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(1, Math.round(seconds / 60));
  }

  return 1;
}

function activeSyncIntervalInSeconds(defaultSeconds: number) {
  const seconds = Number(process.env.SCORES_ACTIVE_SYNC_INTERVAL_SECONDS);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(15, Math.round(seconds));
  }

  return defaultSeconds;
}

function syncIntervalInMinutesFromSeconds(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

function espnDatePart(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function espnCandidateDates(kickoffAt: string | null) {
  if (!kickoffAt) {
    return [];
  }

  const kickoff = new Date(kickoffAt);
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from(
    new Set(
      [kickoff.getTime() - dayMs, kickoff.getTime(), kickoff.getTime() + dayMs]
        .map((time) => espnDatePart(new Date(time))),
    ),
  );
}

function latestScoreUpdate(matches: MatchRow[]) {
  return matches.reduce<string | null>((latest, match) => {
    if (!match.score_updated_at) {
      return latest;
    }

    if (!latest) {
      return match.score_updated_at;
    }

    return new Date(match.score_updated_at) > new Date(latest)
      ? match.score_updated_at
      : latest;
  }, null);
}

function truncateErrorMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

async function fetchMatches(supabase: SyncSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "kickoff_at",
        "round_number",
        "api_football_fixture_id",
        "score_provider",
        "score_provider_fixture_id",
        "status_short",
        "status_long",
        "elapsed",
        "home_score_live",
        "away_score_live",
        "home_score",
        "away_score",
        "score_updated_at",
        "home_team:teams!matches_home_team_id_fkey(id, name)",
        "away_team:teams!matches_away_team_id_fkey(id, name)",
      ].join(", "),
    )
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Omit<MatchRow, "source_table">[]).map(
    (match) => ({
      ...match,
      source_table: "matches" as const,
    }),
  );
}

async function fetchKnockoutMatches(supabase: SyncSupabaseClient) {
  const { data, error } = await supabase
    .from("knockout_matches")
    .select(
      [
        "id",
        "starts_at",
        "round",
        "position",
        "external_match_id",
        "score_provider",
        "score_provider_fixture_id",
        "status_short",
        "status_long",
        "elapsed",
        "home_score_live",
        "away_score_live",
        "home_score",
        "away_score",
        "score_updated_at",
        "team_a",
        "team_a_code",
        "team_b",
        "team_b_code",
      ].join(", "),
    )
    .not("starts_at", "is", null)
    .order("starts_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((match) => ({
    id: String(match.id),
    source_table: "knockout_matches" as const,
    kickoff_at: typeof match.starts_at === "string" ? match.starts_at : null,
    round_number: null,
    api_football_fixture_id: null,
    score_provider:
      typeof match.score_provider === "string" ? match.score_provider : "espn",
    score_provider_fixture_id:
      typeof match.score_provider_fixture_id === "string"
        ? match.score_provider_fixture_id
        : typeof match.external_match_id === "string"
          ? match.external_match_id
          : null,
    status_short:
      typeof match.status_short === "string" ? match.status_short : null,
    status_long:
      typeof match.status_long === "string" ? match.status_long : null,
    elapsed: typeof match.elapsed === "number" ? match.elapsed : null,
    home_score_live:
      typeof match.home_score_live === "number"
        ? match.home_score_live
        : null,
    away_score_live:
      typeof match.away_score_live === "number"
        ? match.away_score_live
        : null,
    home_score: typeof match.home_score === "number" ? match.home_score : null,
    away_score: typeof match.away_score === "number" ? match.away_score : null,
    score_updated_at:
      typeof match.score_updated_at === "string"
        ? match.score_updated_at
        : null,
    home_team:
      typeof match.team_a === "string"
        ? {
            id: `knockout:${match.id}:a`,
            name: match.team_a,
            code: typeof match.team_a_code === "string" ? match.team_a_code : null,
          }
        : null,
    away_team:
      typeof match.team_b === "string"
        ? {
            id: `knockout:${match.id}:b`,
            name: match.team_b,
            code: typeof match.team_b_code === "string" ? match.team_b_code : null,
          }
        : null,
  }));
}

function knockoutWinnerUpdateFromScore(
  match: MatchRow,
  homeScore: number | null,
  awayScore: number | null,
  isFinal: boolean,
): Pick<MatchUpdate, "winner_team" | "winner_team_code"> {
  if (
    match.source_table !== "knockout_matches" ||
    !isFinal ||
    typeof homeScore !== "number" ||
    typeof awayScore !== "number" ||
    homeScore === awayScore
  ) {
    return {};
  }

  const winner = homeScore > awayScore ? match.home_team : match.away_team;

  if (!winner?.name) {
    return {};
  }

  return {
    winner_team: winner.name,
    winner_team_code: winner.code ?? null,
  };
}

function knockoutWinnerUpdateFromEspn(input: {
  match: MatchRow;
  event: EspnEvent;
  homeScore: number | null;
  awayScore: number | null;
  isFinal: boolean;
}): Pick<MatchUpdate, "winner_team" | "winner_team_code"> {
  if (input.match.source_table !== "knockout_matches" || !input.isFinal) {
    return {};
  }

  const winner = getEspnWinner(input.event);
  const localWinner =
    winner?.side === "home"
      ? input.match.home_team
      : winner?.side === "away"
        ? input.match.away_team
        : null;

  if (localWinner?.name) {
    return {
      winner_team: localWinner.name,
      winner_team_code: localWinner.code ?? winner?.code ?? null,
    };
  }

  return knockoutWinnerUpdateFromScore(
    input.match,
    input.homeScore,
    input.awayScore,
    input.isFinal,
  );
}

function providerFixtureIdForMatch(
  match: MatchRow,
  provider: LiveScoreProvider,
) {
  if (provider === "api-football") {
    return (
      (match.score_provider === "api-football"
        ? match.score_provider_fixture_id
        : null) ??
      (match.api_football_fixture_id !== null
        ? String(match.api_football_fixture_id)
        : null)
    );
  }

  if (provider === "worldcup26") {
    return match.score_provider === provider
      ? match.score_provider_fixture_id
      : null;
  }

  if (provider === "espn") {
    return match.score_provider === provider
      ? match.score_provider_fixture_id
      : null;
  }

  if (match.score_provider !== provider) {
    return null;
  }

  return match.score_provider_fixture_id;
}

async function fetchProviderFixtures(
  provider: LiveScoreProvider,
  today: string,
  matchdays: number[],
) {
  const cacheKey =
    provider === "football-data"
      ? `${provider}:${matchdays.join(",")}`
      : `${provider}:${today}`;
  const cachedFixtures = providerFixturesCache.get(cacheKey);

  if (cachedFixtures) {
    logProviderCacheHit(provider, cacheKey);
    return {
      fixtures: await cachedFixtures,
      externalRequests: 0,
    };
  }

  logProviderCacheMiss(provider, cacheKey);

  if (provider === "football-data") {
    const fixturesPromise = fetchFootballDataMatchesByMatchdays(matchdays);

    providerFixturesCache.set(cacheKey, fixturesPromise);

    return {
      fixtures: await fixturesPromise,
      externalRequests: matchdays.length,
    };
  }

  const fixturesPromise = fetchApiFootballFixturesByDate({
    date: today,
    timezone: TIMEZONE,
  });

  providerFixturesCache.set(cacheKey, fixturesPromise);

  return {
    fixtures: await fixturesPromise,
    externalRequests: 1,
  };
}

async function fetchCachedWorldcup26Games() {
  const cacheKey = "games";
  const cachedGames = worldcup26GamesCache.get(cacheKey);

  if (cachedGames) {
    logProviderCacheHit("worldcup26 games", cacheKey);
    return {
      games: await cachedGames,
      externalRequests: 0,
    };
  }

  logProviderCacheMiss("worldcup26 games", cacheKey);

  const gamesPromise = fetchWorldcup26Games();

  worldcup26GamesCache.set(cacheKey, gamesPromise);

  return {
    games: await gamesPromise,
    externalRequests: 1,
  };
}

async function fetchCachedWorldcup26GameByMongoId(fixtureId: string) {
  const cachedGame = worldcup26GameCache.get(fixtureId);

  if (cachedGame) {
    logProviderCacheHit("worldcup26 game", fixtureId);
    return {
      game: await cachedGame,
      externalRequests: 0,
    };
  }

  logProviderCacheMiss("worldcup26 game", fixtureId);

  const gamePromise = fetchWorldcup26GameByMongoId(fixtureId);

  worldcup26GameCache.set(fixtureId, gamePromise);

  return {
    game: await gamePromise,
    externalRequests: 1,
  };
}

async function fetchCachedEspnScoreboardByDate(date: string) {
  logProviderCacheMiss("espn scoreboard", date);
  return {
    events: await fetchEspnScoreboardByDate(date),
    externalRequests: 1,
  };
}

async function fetchCachedEspnSummaryByEventId(fixtureId: string) {
  logProviderCacheMiss("espn summary", fixtureId);
  return {
    event: await fetchEspnSummaryByEventId(fixtureId),
    externalRequests: 1,
  };
}

function isWorldcup26NotStarted(fixture: LiveScoreFixture) {
  return fixture.statusShort === "NS";
}

function isCompleteScore(fixture: LiveScoreFixture) {
  return (
    typeof fixture.homeScore === "number" &&
    typeof fixture.awayScore === "number"
  );
}

function localScoreLabel(match: MatchRow) {
  const homeScore =
    typeof match.home_score_live === "number"
      ? match.home_score_live
      : match.home_score;
  const awayScore =
    typeof match.away_score_live === "number"
      ? match.away_score_live
      : match.away_score;

  return `${homeScore ?? "null"} x ${awayScore ?? "null"}`;
}

function worldcup26FixtureMatches(match: MatchRow, fixture: LiveScoreFixture) {
  return worldcup26TeamsMatch({
    localHomeName: match.home_team?.name,
    localAwayName: match.away_team?.name,
    providerHomeName: fixture.homeTeamName,
    providerAwayName: fixture.awayTeamName,
  });
}

function espnFixtureMatches(match: MatchRow, fixture: LiveScoreFixture) {
  return espnTeamsMatch({
    localHomeName: match.home_team?.name,
    localAwayName: match.away_team?.name,
    providerHomeName: fixture.homeTeamName,
    providerAwayName: fixture.awayTeamName,
  });
}

function espnEventMatches(match: MatchRow, event: EspnEvent) {
  const fixture = mapEspnEventToInternalMatch(event);

  return Boolean(fixture && espnFixtureMatches(match, fixture));
}

function mergeEspnEvents(primary: EspnEvent, secondary: EspnEvent | null) {
  if (!secondary) {
    return primary;
  }

  const primaryCompetition = primary.competitions?.[0];
  const secondaryCompetition = secondary.competitions?.[0];
  const primaryDetails = primaryCompetition?.details ?? [];
  const secondaryDetails = secondaryCompetition?.details ?? [];
  const details =
    primaryDetails.length >= secondaryDetails.length
      ? primaryDetails
      : secondaryDetails;
  const competition =
    primaryCompetition || secondaryCompetition
      ? {
          ...(primaryCompetition ?? {}),
          ...(secondaryCompetition ?? {}),
          competitors:
            secondaryCompetition?.competitors ?? primaryCompetition?.competitors,
          details,
        }
      : undefined;

  return {
    ...primary,
    ...secondary,
    date: primary.date ?? secondary.date,
    name: primary.name ?? secondary.name,
    shortName: primary.shortName ?? secondary.shortName,
    status: secondary.status ?? primary.status,
    competitions: competition ? [competition] : primary.competitions,
  };
}

async function fetchWorldcup26FixtureForMatch(input: {
  match: MatchRow;
  allFixtures: LiveScoreFixture[] | null;
}) {
  const fixtureId = providerFixtureIdForMatch(input.match, "worldcup26");

  if (fixtureId) {
    const { game, externalRequests } =
      await fetchCachedWorldcup26GameByMongoId(fixtureId);
    const fixture = mapWorldcup26GameToInternalScore(game, {
      homeTeamName: input.match.home_team?.name,
      awayTeamName: input.match.away_team?.name,
    });

    return {
      fixture,
      fixtureId,
      usedGamesEndpoint: false,
      externalRequests,
    };
  }

  const fixture =
    input.allFixtures?.find((candidate) =>
      worldcup26FixtureMatches(input.match, candidate),
    ) ?? null;

  return {
    fixture,
    fixtureId: fixture ? String(fixture.providerFixtureId) : null,
    usedGamesEndpoint: true,
    externalRequests: 0,
  };
}

async function runWorldcup26Sync(input: {
  supabase: SyncSupabaseClient;
  startedAt: Date;
  activeMatches: MatchRow[];
  nextRecommendedSyncInMinutes: number;
  now: Date;
}) {
  let allFixtures: LiveScoreFixture[] | null = null;
  let externalRequests = 0;
  let updatedMatches = 0;
  let liveFixtures = 0;

  const needsFallbackMapping = input.activeMatches.some(
    (match) => !providerFixtureIdForMatch(match, "worldcup26"),
  );

  if (needsFallbackMapping) {
    const { games, externalRequests: gamesExternalRequests } =
      await fetchCachedWorldcup26Games();
    externalRequests += gamesExternalRequests;
    allFixtures = games
      .map((game) => mapWorldcup26GameToInternalScore(game))
      .filter((fixture): fixture is LiveScoreFixture => Boolean(fixture));
  }

  for (const match of input.activeMatches) {
    console.log(
      `[worldcup26] active match: ${match.home_team?.name ?? "Home"} x ${match.away_team?.name ?? "Away"}`,
    );

    let fixture: LiveScoreFixture | null = null;
    let fixtureId: string | null = null;

    try {
      const result = await fetchWorldcup26FixtureForMatch({
        match,
        allFixtures,
      });

      fixture = result.fixture;
      fixtureId = result.fixtureId;
      externalRequests += result.externalRequests;
    } catch (error) {
      console.warn(
        `[worldcup26] failed to fetch mapped game: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      continue;
    }

    if (!fixture || !fixtureId) {
      console.log("[worldcup26] no matching fixture found");
      continue;
    }

    console.log(`[worldcup26] game id: ${fixtureId}`);
    console.log(
      `[worldcup26] API score: ${fixture.homeTeamName} ${fixture.homeScore} x ${fixture.awayScore} ${fixture.awayTeamName} - ${fixture.statusLong}`,
    );
    console.log(`[worldcup26] local score before: ${localScoreLabel(match)}`);

    if (!isCompleteScore(fixture)) {
      console.log("[worldcup26] skipped invalid/null score");
      continue;
    }

    if (isFinalMatchStatus(match.status_short) && !isFinalMatchStatus(fixture.statusShort)) {
      console.log("[worldcup26] skipped downgrade from FT");
      continue;
    }

    if (isWorldcup26NotStarted(fixture)) {
      console.log("[worldcup26] skipped notstarted status");
      continue;
    }

    const scoreChanged =
      match.home_score_live !== fixture.homeScore ||
      match.away_score_live !== fixture.awayScore;

    if (scoreChanged) {
      console.log(
        `Gol ou alteração de placar detectada: ${match.home_team?.name ?? "Home"} ${localScoreLabel(match)} ${match.away_team?.name ?? "Away"} -> ${match.home_team?.name ?? "Home"} ${fixture.homeScore} x ${fixture.awayScore} ${match.away_team?.name ?? "Away"}`,
      );
    }

    const isFinal = isFinalMatchStatus(fixture.statusShort);
    const update: MatchUpdate = {
      status_short: fixture.statusShort,
      status_long: fixture.statusLong,
      elapsed: fixture.elapsed,
      home_score_live: fixture.homeScore,
      away_score_live: fixture.awayScore,
      home_score: isFinal ? fixture.homeScore : match.home_score,
      away_score: isFinal ? fixture.awayScore : match.away_score,
      score_updated_at: input.now.toISOString(),
      score_provider: "worldcup26",
      score_provider_fixture_id: fixtureId,
      ...knockoutWinnerUpdateFromScore(
        match,
        fixture.homeScore,
        fixture.awayScore,
        isFinal,
      ),
    };

    await updateMatch(input.supabase, match, update);
    updatedMatches += 1;

    if (isLiveMatchStatus(fixture.statusShort)) {
      liveFixtures += 1;
    }

    console.log(
      `[worldcup26] updated local score: ${fixture.homeScore} x ${fixture.awayScore}`,
    );
  }

  return finishWithLog(input.supabase, input.startedAt, {
    status: "synced",
    reason: "active_match_window",
    provider: "worldcup26",
    externalRequests,
    updatedMatches,
    activeMatches: input.activeMatches.length,
    activeMatchdays: [],
    liveFixtures,
    nextRecommendedSyncInMinutes: input.nextRecommendedSyncInMinutes,
  });
}

async function fetchEspnEventForMatch(input: {
  match: MatchRow;
  eventsByDate: Map<string, EspnEvent[]>;
}) {
  const fixtureId = providerFixtureIdForMatch(input.match, "espn");
  let externalRequests = 0;
  const scoreboardDates = espnCandidateDates(input.match.kickoff_at);

  if (fixtureId) {
    const {
      event: summaryEvent,
      externalRequests: summaryExternalRequests,
    } = await fetchCachedEspnSummaryByEventId(fixtureId);
    let scoreboardEvent: EspnEvent | null = null;
    let matchedScoreboardDate: string | null = null;
    externalRequests += summaryExternalRequests;

    for (const date of scoreboardDates) {
      let events = input.eventsByDate.get(date);

      if (!events) {
        const result = await fetchCachedEspnScoreboardByDate(date);
        events = result.events;
        input.eventsByDate.set(date, events);
        externalRequests += result.externalRequests;
      }

      scoreboardEvent =
        events.find((candidate) => String(candidate.id) === fixtureId) ?? null;

      if (scoreboardEvent) {
        matchedScoreboardDate = date;
        break;
      }
    }

    return {
      event: mergeEspnEvents(scoreboardEvent ?? summaryEvent, summaryEvent),
      fixtureId,
      usedScoreboardEndpoint: false,
      externalRequests,
      scoreboardDates,
      matchedScoreboardDate,
      scoreboardStatusDebug: espnStatusDebugLabel(scoreboardEvent),
      summaryStatusDebug: espnStatusDebugLabel(summaryEvent),
    };
  }

  for (const date of scoreboardDates) {
    let events = input.eventsByDate.get(date);

    if (!events) {
      const result = await fetchCachedEspnScoreboardByDate(date);
      events = result.events;
      input.eventsByDate.set(date, events);
      externalRequests += result.externalRequests;
    }

    const event = events.find((candidate) =>
      espnEventMatches(input.match, candidate),
    );
    const fixture = event ? mapEspnEventToInternalMatch(event) : null;

    if (event && fixture) {
      return {
        event,
        fixtureId: String(fixture.providerFixtureId),
        usedScoreboardEndpoint: true,
        externalRequests,
        scoreboardDates,
        matchedScoreboardDate: date,
        scoreboardStatusDebug: espnStatusDebugLabel(event),
        summaryStatusDebug: null,
      };
    }
  }

  return {
    event: null,
    fixtureId: null,
    usedScoreboardEndpoint: true,
    externalRequests,
    scoreboardDates,
    matchedScoreboardDate: null,
    scoreboardStatusDebug: "event=null",
    summaryStatusDebug: null,
  };
}

function teamIdForEspnGoal(match: MatchRow, goal: EspnGoal) {
  if (
    espnTeamsMatch({
      localHomeName: match.home_team?.name,
      localAwayName: match.away_team?.name,
      providerHomeName: goal.teamName,
      providerAwayName: match.away_team?.name,
    })
  ) {
    return match.home_team?.id ?? null;
  }

  if (
    espnTeamsMatch({
      localHomeName: match.away_team?.name,
      localAwayName: match.home_team?.name,
      providerHomeName: goal.teamName,
      providerAwayName: match.home_team?.name,
    })
  ) {
    return match.away_team?.id ?? null;
  }

  return null;
}

async function goalAlreadyExists(
  supabase: SyncSupabaseClient,
  match: MatchRow,
  goal: EspnGoal,
) {
  let query = supabase
    .from("match_goals")
    .select("id")
    .eq("match_id", match.id)
    .eq("provider", "espn")
    .limit(1);

  if (goal.providerEventId) {
    query = query.eq("provider_event_id", goal.providerEventId);
  } else {
    query = query.is("provider_event_id", null);
    query =
      goal.minute === null
        ? query.is("minute", null)
        : query.eq("minute", goal.minute);
    query =
      goal.teamName === null
        ? query.is("team_name", null)
        : query.eq("team_name", goal.teamName);
    query =
      goal.playerName === null
        ? query.is("player_name", null)
        : query.eq("player_name", goal.playerName);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function saveEspnGoals(input: {
  supabase: SyncSupabaseClient;
  match: MatchRow;
  event: EspnEvent;
}) {
  if (input.match.source_table === "knockout_matches") {
    return {
      foundGoals: 0,
      insertedGoals: 0,
    };
  }

  const goals = extractEspnGoals(input.event);
  let insertedGoals = 0;

  for (const goal of goals) {
    try {
      const exists = await goalAlreadyExists(input.supabase, input.match, goal);

      if (exists) {
        continue;
      }

      if (isScoreDryRunEnabled()) {
        insertedGoals += 1;
        console.log(
          `[dry-run][espn] Would insert goal: ${input.match.home_team?.name ?? "Home"} x ${input.match.away_team?.name ?? "Away"} - ${goal.playerName ?? "Jogador"} ${goal.minute ?? "?"}'`,
        );
        continue;
      }

      const { error } = await input.supabase.from("match_goals").insert({
        match_id: input.match.id,
        provider: "espn",
        provider_event_id: goal.providerEventId,
        minute: goal.minute,
        team_name: goal.teamName,
        team_id: teamIdForEspnGoal(input.match, goal),
        player_name: goal.playerName,
        goal_type: goal.goalType,
        is_penalty: goal.isPenalty,
        is_own_goal: goal.isOwnGoal,
        raw_event: goal.rawEvent,
      });

      if (error) {
        throw error;
      }

      insertedGoals += 1;
      console.log(
        `[espn] Novo gol detectado: ${input.match.home_team?.name ?? "Home"} x ${input.match.away_team?.name ?? "Away"} - ${goal.playerName ?? "Jogador"} ${goal.minute ?? "?"}'`,
      );
    } catch (error) {
      console.warn(
        `[espn] failed to save goal event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      break;
    }
  }

  return {
    foundGoals: goals.length,
    insertedGoals,
  };
}

async function runEspnSync(input: {
  supabase: SyncSupabaseClient;
  startedAt: Date;
  activeMatches: MatchRow[];
  nextRecommendedSyncInMinutes: number;
  nextRecommendedSyncInSeconds: number;
  now: Date;
}) {
  const eventsByDate = new Map<string, EspnEvent[]>();
  let externalRequests = 0;
  let updatedMatches = 0;
  let liveFixtures = 0;
  let insertedGoals = 0;

  for (const match of input.activeMatches) {
    console.log(
      `[espn] active match: ${match.home_team?.name ?? "Home"} x ${match.away_team?.name ?? "Away"}`,
    );

    let event: EspnEvent | null = null;
    let fixtureId: string | null = null;
    let scoreboardDates: string[] = [];
    let matchedScoreboardDate: string | null = null;
    let scoreboardStatusDebug = "event=null";
    let summaryStatusDebug: string | null = null;

    try {
      const result = await fetchEspnEventForMatch({
        match,
        eventsByDate,
      });

      event = result.event;
      fixtureId = result.fixtureId;
      externalRequests += result.externalRequests;
      scoreboardDates = result.scoreboardDates;
      matchedScoreboardDate = result.matchedScoreboardDate;
      scoreboardStatusDebug = result.scoreboardStatusDebug;
      summaryStatusDebug = result.summaryStatusDebug;
    } catch (error) {
      console.warn(
        `[espn] failed to fetch event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      continue;
    }

    if (!event || !fixtureId) {
      console.log("[espn] no matching event found");
      continue;
    }

    const fixture = mapEspnEventToInternalMatch(event);

    if (!fixture) {
      console.log("[espn] skipped event with incomplete team data");
      continue;
    }

    console.log(`[espn] event id: ${fixtureId}`);
    console.log(
      `[espn] scoreboard dates checked: ${scoreboardDates.join(", ") || "none"}; matched date: ${matchedScoreboardDate ?? "none"}`,
    );
    console.log(`[espn] scoreboard raw status: ${scoreboardStatusDebug}`);
    if (summaryStatusDebug) {
      console.log(`[espn] summary raw status: ${summaryStatusDebug}`);
    }
    console.log(
      `[espn] API score: ${fixture.homeTeamName} ${fixture.homeScore} x ${fixture.awayScore} ${fixture.awayTeamName} - ${fixture.statusLong}`,
    );
    console.log(`[espn] local score before: ${localScoreLabel(match)}`);

    if (!isCompleteScore(fixture)) {
      console.log("[espn] skipped invalid/null score");
      continue;
    }

    if (isFinalMatchStatus(match.status_short) && !isFinalMatchStatus(fixture.statusShort)) {
      console.log("[espn] skipped downgrade from FT");
      continue;
    }

    const scoreChanged =
      match.home_score_live !== fixture.homeScore ||
      match.away_score_live !== fixture.awayScore;
    const isCurrentHalftime =
      isHalftimeStatus(fixture.statusShort) &&
      isPlausibleCurrentHalftime(match, input.now);
    const staleHalftimeAfterLive =
      isLiveMatchStatus(match.status_short) &&
      isHalftimeStatus(fixture.statusShort) &&
      !isCurrentHalftime;
    const latestGoalMinute = extractEspnGoals(event).reduce<number | null>(
      (latest, goal) =>
        typeof goal.minute === "number" && goal.minute > (latest ?? 0)
          ? goal.minute
          : latest,
      null,
    );

    const hasNewerGoalMinute =
      typeof latestGoalMinute === "number" &&
      latestGoalMinute > (match.elapsed ?? 0);
    const locallyEstimatedElapsed = estimatedElapsedFromLocalClock(
      match,
      input.now,
    );
    const hasEstimatedElapsedProgress =
      !isCurrentHalftime &&
      typeof locallyEstimatedElapsed === "number" &&
      locallyEstimatedElapsed > (match.elapsed ?? 0);

    if (
      staleHalftimeAfterLive &&
      !scoreChanged &&
      !hasNewerGoalMinute &&
      !hasEstimatedElapsedProgress
    ) {
      console.log("[espn] skipped stale halftime status after LIVE");
      continue;
    }

    if (
      !isFinalMatchStatus(fixture.statusShort) &&
      typeof match.elapsed === "number" &&
      typeof fixture.elapsed === "number" &&
      fixture.elapsed < match.elapsed &&
      !isCurrentHalftime &&
      !scoreChanged &&
      !hasNewerGoalMinute &&
      !hasEstimatedElapsedProgress
    ) {
      console.log("[espn] skipped stale elapsed minute");
      continue;
    }

    if (fixture.statusShort === "NS") {
      console.log("[espn] skipped notstarted status");
      continue;
    }

    const isFinal = isFinalMatchStatus(fixture.statusShort);
    const statusShort = staleHalftimeAfterLive
      ? match.status_short
      : fixture.statusShort;
    const statusLong = staleHalftimeAfterLive
      ? match.status_long
      : fixture.statusLong;
    const elapsed = isFinal
      ? fixture.elapsed
      : isCurrentHalftime
        ? bestElapsedMinute([fixture.elapsed, latestGoalMinute])
      : bestElapsedMinute([
          match.elapsed,
          fixture.elapsed,
          latestGoalMinute,
          locallyEstimatedElapsed,
        ]);
    const update: MatchUpdate = {
      status_short: statusShort,
      status_long: statusLong,
      elapsed,
      home_score_live: fixture.homeScore,
      away_score_live: fixture.awayScore,
      home_score: isFinal ? fixture.homeScore : match.home_score,
      away_score: isFinal ? fixture.awayScore : match.away_score,
      score_updated_at: input.now.toISOString(),
      score_provider: "espn",
      score_provider_fixture_id: fixtureId,
      ...knockoutWinnerUpdateFromEspn({
        match,
        event,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        isFinal,
      }),
    };

    await updateMatch(input.supabase, match, update);
    updatedMatches += 1;

    const goalResult = await saveEspnGoals({
      supabase: input.supabase,
      match,
      event,
    });
    if (match.source_table === "matches") {
      insertedGoals += goalResult.insertedGoals;
    }

    if (isLiveMatchStatus(statusShort)) {
      liveFixtures += 1;
    }

    console.log(
      `[espn] updated local score: ${fixture.homeScore} x ${fixture.awayScore}; goals found: ${goalResult.foundGoals}; goals inserted: ${goalResult.insertedGoals}`,
    );
  }

  return finishWithLog(input.supabase, input.startedAt, {
    status: "synced",
    reason: insertedGoals > 0 ? "active_match_window_goals" : "active_match_window",
    provider: "espn",
    externalRequests,
    updatedMatches,
    activeMatches: input.activeMatches.length,
    activeMatchdays: [],
    liveFixtures,
    nextRecommendedSyncInMinutes: input.nextRecommendedSyncInMinutes,
    nextRecommendedSyncInSeconds: input.nextRecommendedSyncInSeconds,
  });
}

async function updateMatch(
  supabase: SyncSupabaseClient,
  match: MatchRow,
  update: MatchUpdate,
) {
  if (isScoreDryRunEnabled()) {
    console.log(
      `[dry-run] Would update ${match.source_table} ${match.id}: ${JSON.stringify({
        status_short: update.status_short,
        elapsed: update.elapsed,
        home_score_live: update.home_score_live,
        away_score_live: update.away_score_live,
        home_score: update.home_score,
        away_score: update.away_score,
        score_provider: update.score_provider,
        score_provider_fixture_id: update.score_provider_fixture_id,
        winner_team: update.winner_team,
        winner_team_code: update.winner_team_code,
      })}`,
    );
    return;
  }

  const { error } =
    match.source_table === "knockout_matches"
      ? await supabase.from("knockout_matches").update(update).eq("id", match.id)
      : await supabase.from("matches").update(update).eq("id", match.id);

  if (error) {
    throw error;
  }
}

async function insertSyncLog(
  supabase: SyncSupabaseClient,
  log: LiveScoreSyncLogInsert,
) {
  if (isScoreDryRunEnabled()) {
    console.log(
      `[dry-run] Would insert live_score_sync_logs row: ${JSON.stringify({
        provider: log.provider,
        status: log.status,
        reason: log.reason,
        active_matches_count: log.active_matches_count,
        updated_matches_count: log.updated_matches_count,
        requested_matchdays: log.requested_matchdays,
      })}`,
    );
    return;
  }

  const { error } = await supabase.from("live_score_sync_logs").insert(log);

  if (error) {
    console.warn(`Failed to write live score sync log: ${error.message}`);
  }
}

function logStatusForResult(result: LiveScoreSyncResult): SyncStatus {
  if (result.status === "synced") {
    return "success";
  }

  return result.status;
}

function logSyncResultSummary(
  result: LiveScoreSyncResult,
  startedAt: Date,
) {
  const durationMs = Date.now() - startedAt.getTime();

  console.log("Live score sync summary:");
  console.log(`- status: ${result.status}`);
  console.log(`- reason: ${result.reason}`);
  console.log(`- provider: ${result.provider}`);
  console.log(`- active matches: ${result.activeMatches ?? 0}`);
  console.log(`- updated matches: ${result.updatedMatches}`);
  console.log(`- live fixtures: ${result.liveFixtures ?? 0}`);
  console.log(`- external requests: ${result.externalRequests}`);
  console.log(`- duration: ${durationMs}ms`);

  if (result.nextRecommendedSyncInSeconds) {
    console.log(
      `- next recommended sync: ${result.nextRecommendedSyncInSeconds}s`,
    );
  } else if (result.nextRecommendedSyncInMinutes) {
    console.log(
      `- next recommended sync: ${result.nextRecommendedSyncInMinutes}min`,
    );
  }

  if (result.message) {
    console.log(`- message: ${result.message}`);
  }
}

async function finishWithLog(
  supabase: SyncSupabaseClient,
  startedAt: Date,
  result: LiveScoreSyncResult,
) {
  logSyncResultSummary(result, startedAt);

  await insertSyncLog(supabase, {
    provider: result.provider,
    status: logStatusForResult(result),
    reason: result.reason,
    active_matches_count: result.activeMatches ?? 0,
    updated_matches_count: result.updatedMatches,
    requested_matchdays: result.activeMatchdays ?? [],
    error_message: truncateErrorMessage(result.message),
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  });

  return result;
}

async function runLiveScoreSyncForTarget(
  supabaseConfig: ScoreSupabaseConfig,
): Promise<LiveScoreSyncResult> {
  const startedAt = new Date();
  const provider = currentProvider();
  const dryRun = isScoreDryRunEnabled();
  const supabase = createServiceClient(supabaseConfig);

  logScoreSupabaseTarget("Live score sync", supabaseConfig, dryRun);
  console.log(`Started at: ${startedAt.toISOString()}`);
  console.log(`Provider: ${provider}`);

  try {
    if (provider === "manual") {
      console.log("Skipping sync: manual provider selected.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "manual_provider",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatchdays: [],
      });
    }

    if (provider === "api-football" && !process.env.API_FOOTBALL_KEY) {
      console.log("Skipping sync: missing API_FOOTBALL_KEY.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "missing_api_key",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatchdays: [],
      });
    }

    if (provider === "football-data" && !process.env.FOOTBALL_DATA_API_KEY) {
      console.log("Skipping sync: missing FOOTBALL_DATA_API_KEY.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "missing_football_data_api_key",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatchdays: [],
      });
    }

    const now = new Date();
    const today = datePartInTimezone(now, TIMEZONE);
    const groupMatches = await fetchMatches(supabase);
    const knockoutMatches = await fetchKnockoutMatches(supabase);
    const matches = [...groupMatches, ...knockoutMatches];
    const todayMatches = matches.filter(
      (match) =>
        match.kickoff_at &&
        datePartInTimezone(new Date(match.kickoff_at), TIMEZONE) === today,
    );
    const activeCandidateMatches =
      provider === "espn" || provider === "worldcup26" ? matches : todayMatches;
    const activeMatches = activeCandidateMatches.filter((match) =>
      isWithinActiveWindow(match, now, provider) &&
      ((provider !== "worldcup26" && provider !== "espn") ||
        !isFinalMatchStatus(match.status_short)),
    );
    const kickoffTimes = new Set(
      todayMatches
        .filter((match) => match.kickoff_at)
        .map((match) =>
          timePartInTimezone(new Date(match.kickoff_at as string), TIMEZONE),
        ),
    );
    const nextRecommendedSyncInSeconds =
      provider === "espn" ? activeSyncIntervalInSeconds(30) : undefined;
    const nextRecommendedSyncInMinutes =
      provider === "espn"
        ? syncIntervalInMinutesFromSeconds(nextRecommendedSyncInSeconds ?? 30)
        : provider === "worldcup26"
          ? worldcup26SyncIntervalInMinutes()
          : syncIntervalForKickoffTimes(kickoffTimes.size);

    console.log(`Today (${TIMEZONE}): ${today}`);
    console.log(`Matches loaded: ${matches.length}`);
    console.log(`Group matches loaded: ${groupMatches.length}`);
    console.log(`Knockout matches loaded: ${knockoutMatches.length}`);
    console.log(`Today matches: ${todayMatches.length}`);
    console.log(`Active candidate matches: ${activeCandidateMatches.length}`);
    console.log(`Active matches in window: ${activeMatches.length}`);
    console.log(
      `Kickoff times today: ${
        Array.from(kickoffTimes).join(", ") || "none"
      }`,
    );

    if (activeMatches.length === 0) {
      console.log("Skipping sync: no matches inside active window.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "outside_active_window",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatches: 0,
        activeMatchdays: [],
        nextRecommendedSyncInMinutes,
      });
    }

    if (provider === "worldcup26") {
      return runWorldcup26Sync({
        supabase,
        startedAt,
        activeMatches,
        nextRecommendedSyncInMinutes,
        now,
      });
    }

    if (provider === "espn") {
      return runEspnSync({
        supabase,
        startedAt,
        activeMatches,
        nextRecommendedSyncInMinutes,
        nextRecommendedSyncInSeconds: nextRecommendedSyncInSeconds ?? 30,
        now,
      });
    }

    const mappedActiveMatches = activeMatches.filter(
      (match) => providerFixtureIdForMatch(match, provider) !== null,
    );

    if (mappedActiveMatches.length === 0) {
      console.log("Skipping sync: active matches do not have fixture mapping.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "missing_fixture_mapping",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatches: activeMatches.length,
        activeMatchdays: [],
        nextRecommendedSyncInMinutes,
      });
    }

    const activeMatchdays = Array.from(
      new Set(
        mappedActiveMatches
          .map((match) => match.round_number)
          .filter((roundNumber): roundNumber is number =>
            typeof roundNumber === "number",
          ),
      ),
    ).sort((first, second) => first - second);

    if (provider === "football-data" && activeMatchdays.length === 0) {
      console.log("Skipping sync: missing active matchday for football-data.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "missing_active_matchday",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatches: mappedActiveMatches.length,
        activeMatchdays,
        nextRecommendedSyncInMinutes,
      });
    }

    const allActiveMatchesAreHalftime = mappedActiveMatches.every((match) =>
      isHalftimeStatus(match.status_short),
    );
    const activeHalftimeWasRecentlyUpdated =
      minutesSince(latestScoreUpdate(mappedActiveMatches), now) <
      HALFTIME_PAUSE_MINUTES;

    if (allActiveMatchesAreHalftime && activeHalftimeWasRecentlyUpdated) {
      console.log("Skipping sync: halftime pause is still active.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "halftime_pause",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatches: mappedActiveMatches.length,
        activeMatchdays,
        nextRecommendedSyncInMinutes,
      });
    }

    const latestUpdate = latestScoreUpdate(mappedActiveMatches);

    if (
      latestUpdate &&
      minutesSince(latestUpdate, now) < nextRecommendedSyncInMinutes
    ) {
      console.log("Skipping sync: minimum interval was not reached.");
      return finishWithLog(supabase, startedAt, {
        status: "skipped",
        reason: "minimum_interval_not_reached",
        provider,
        externalRequests: 0,
        updatedMatches: 0,
        activeMatches: mappedActiveMatches.length,
        activeMatchdays,
        nextRecommendedSyncInMinutes,
      });
    }

    let fixtures: LiveScoreFixture[];
    let externalRequests = 0;

    try {
      const result = await fetchProviderFixtures(provider, today, activeMatchdays);

      fixtures = result.fixtures;
      externalRequests = result.externalRequests;
      console.log(`Provider fixtures loaded: ${fixtures.length}`);
      console.log(`Provider external requests: ${externalRequests}`);
    } catch (error) {
      console.warn(
        `Provider fetch failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return finishWithLog(supabase, startedAt, {
        status: "error",
        reason: "provider_error",
        provider,
        externalRequests,
        updatedMatches: 0,
        activeMatches: mappedActiveMatches.length,
        activeMatchdays,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const fixtureById = new Map(
      fixtures.map((fixture) => [String(fixture.providerFixtureId), fixture]),
    );
    let updatedMatches = 0;

    await Promise.all(
      mappedActiveMatches.map(async (match) => {
        const fixtureId = providerFixtureIdForMatch(match, provider);
        const fixture = fixtureId ? fixtureById.get(fixtureId) : null;

        if (!fixture) {
          return;
        }

        const isFinal = isFinalMatchStatus(fixture.statusShort);
        const update: MatchUpdate = {
          status_short: fixture.statusShort,
          status_long: fixture.statusLong,
          elapsed: fixture.elapsed,
          home_score_live: fixture.homeScore,
          away_score_live: fixture.awayScore,
          home_score:
            isFinal && fixture.homeScore !== null
              ? fixture.homeScore
              : match.home_score,
          away_score:
            isFinal && fixture.awayScore !== null
              ? fixture.awayScore
              : match.away_score,
          score_updated_at: now.toISOString(),
          ...knockoutWinnerUpdateFromScore(
            match,
            fixture.homeScore,
            fixture.awayScore,
            isFinal,
          ),
        };

        await updateMatch(supabase, match, update);
        updatedMatches += 1;
      }),
    );

    return finishWithLog(supabase, startedAt, {
      status: "synced",
      reason: "active_match_window",
      provider,
      externalRequests,
      updatedMatches,
      activeMatches: mappedActiveMatches.length,
      activeMatchdays,
      liveFixtures: fixtures.filter((fixture) =>
        isLiveMatchStatus(fixture.statusShort),
      ).length,
      nextRecommendedSyncInMinutes,
    });
  } catch (error) {
    console.error(
      `Unexpected live score sync error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return finishWithLog(supabase, startedAt, {
      status: "error",
      reason: "unexpected_error",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
      activeMatchdays: [],
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function runLiveScoreSync(): Promise<LiveScoreSyncResult> {
  const supabaseConfigs = resolveScoreSupabaseEnvs();
  const results: LiveScoreSyncResult[] = [];
  const dryRun = isScoreDryRunEnabled();

  logScoreSupabaseTargets("Live score multi-target sync", supabaseConfigs, dryRun);

  for (const supabaseConfig of supabaseConfigs) {
    results.push(await runLiveScoreSyncForTarget(supabaseConfig));
  }

  if (results.length === 1) {
    return results[0];
  }

  const hasError = results.some((result) => result.status === "error");
  const hasSynced = results.some((result) => result.status === "synced");
  const provider = results[0]?.provider ?? currentProvider();
  const externalRequests = results.reduce(
    (total, result) => total + result.externalRequests,
    0,
  );
  const updatedMatches = results.reduce(
    (total, result) => total + result.updatedMatches,
    0,
  );
  const activeMatches = results.reduce(
    (total, result) => total + (result.activeMatches ?? 0),
    0,
  );
  const liveFixtures = results.reduce(
    (total, result) => total + (result.liveFixtures ?? 0),
    0,
  );

  console.log("\n=== Multi-target sync summary ===");
  console.log(`Targets processed: ${results.length}`);
  console.log(`Status: ${hasError ? "error" : hasSynced ? "synced" : "skipped"}`);
  console.log(`Provider: ${provider}`);
  console.log(`Active matches total: ${activeMatches}`);
  console.log(`Updated matches total: ${updatedMatches}`);
  console.log(`Live fixtures total: ${liveFixtures}`);
  console.log(`External requests total: ${externalRequests}`);

  return {
    status: hasError ? "error" : hasSynced ? "synced" : "skipped",
    reason: "multi_target_sync",
    provider,
    externalRequests,
    updatedMatches,
    activeMatches,
    liveFixtures,
    message: results
      .map((result) => `${result.provider}:${result.status}:${result.reason}`)
      .join("; "),
  };
}
