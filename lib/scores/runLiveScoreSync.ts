import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchApiFootballFixturesByDate } from "@/lib/scores/providers/apiFootball";
import { fetchFootballDataMatchesByMatchdays } from "@/lib/scores/providers/footballData";
import type { LiveScoreFixture } from "@/lib/scores/providers/types";
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

const TIMEZONE = "America/Sao_Paulo";
const ACTIVE_WINDOW_BEFORE_MINUTES = 5;
const ACTIVE_WINDOW_AFTER_MINUTES = 150;
const HALFTIME_PAUSE_MINUTES = 15;
const MAX_ERROR_MESSAGE_LENGTH = 500;

type LiveScoreProvider = "api-football" | "football-data" | "manual" | "worldcup26";
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
      live_score_sync_logs: {
        Row: never;
        Insert: LiveScoreSyncLogInsert;
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
    name: string;
  } | null;
  away_team?: {
    name: string;
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
  message?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

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
    provider === "manual"
  ) {
    return provider;
  }

  console.warn(
    `Invalid LIVE_SCORE_PROVIDER "${provider}". Falling back to manual provider.`,
  );
  return "manual";
}

function createServiceClient(): SyncSupabaseClient {
  return createClient<SyncDatabase>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
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

function isWithinActiveWindow(match: MatchRow, now: Date) {
  if (!match.kickoff_at) {
    return false;
  }

  const kickoff = new Date(match.kickoff_at);
  const windowStart = new Date(
    kickoff.getTime() - ACTIVE_WINDOW_BEFORE_MINUTES * 60 * 1000,
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
        "home_team:teams!matches_home_team_id_fkey(name)",
        "away_team:teams!matches_away_team_id_fkey(name)",
      ].join(", "),
    )
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MatchRow[];
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
  if (provider === "football-data") {
    return fetchFootballDataMatchesByMatchdays(matchdays);
  }

  return fetchApiFootballFixturesByDate({
    date: today,
    timezone: TIMEZONE,
  });
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

async function fetchWorldcup26FixtureForMatch(input: {
  match: MatchRow;
  allFixtures: LiveScoreFixture[] | null;
}) {
  const fixtureId = providerFixtureIdForMatch(input.match, "worldcup26");

  if (fixtureId) {
    const game = await fetchWorldcup26GameByMongoId(fixtureId);
    const fixture = mapWorldcup26GameToInternalScore(game, {
      homeTeamName: input.match.home_team?.name,
      awayTeamName: input.match.away_team?.name,
    });

    return {
      fixture,
      fixtureId,
      usedGamesEndpoint: false,
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
    const games = await fetchWorldcup26Games();
    externalRequests += 1;
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

      if (!result.usedGamesEndpoint) {
        externalRequests += 1;
      }
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

async function updateMatch(
  supabase: SyncSupabaseClient,
  match: MatchRow,
  update: MatchUpdate,
) {
  const { error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", match.id);

  if (error) {
    throw error;
  }
}

async function insertSyncLog(
  supabase: SyncSupabaseClient,
  log: LiveScoreSyncLogInsert,
) {
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

async function finishWithLog(
  supabase: SyncSupabaseClient,
  startedAt: Date,
  result: LiveScoreSyncResult,
) {
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

export async function runLiveScoreSync(): Promise<LiveScoreSyncResult> {
  const startedAt = new Date();
  const provider = currentProvider();
  const supabase = createServiceClient();

  try {
    if (provider === "manual") {
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
    const matches = await fetchMatches(supabase);
    const todayMatches = matches.filter(
      (match) =>
        match.kickoff_at &&
        datePartInTimezone(new Date(match.kickoff_at), TIMEZONE) === today,
    );
    const activeMatches = todayMatches.filter((match) =>
      isWithinActiveWindow(match, now) &&
      (provider !== "worldcup26" || !isFinalMatchStatus(match.status_short)),
    );
    const kickoffTimes = new Set(
      todayMatches
        .filter((match) => match.kickoff_at)
        .map((match) =>
          timePartInTimezone(new Date(match.kickoff_at as string), TIMEZONE),
        ),
    );
    const nextRecommendedSyncInMinutes =
      provider === "worldcup26"
        ? worldcup26SyncIntervalInMinutes()
        : syncIntervalForKickoffTimes(kickoffTimes.size);

    if (activeMatches.length === 0) {
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

    const mappedActiveMatches = activeMatches.filter(
      (match) => providerFixtureIdForMatch(match, provider) !== null,
    );

    if (mappedActiveMatches.length === 0) {
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
    const expectedExternalRequests =
      provider === "football-data" ? activeMatchdays.length : 1;

    try {
      fixtures = await fetchProviderFixtures(provider, today, activeMatchdays);
    } catch (error) {
      return finishWithLog(supabase, startedAt, {
        status: "error",
        reason: "provider_error",
        provider,
        externalRequests: expectedExternalRequests,
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
        };

        await updateMatch(supabase, match, update);
        updatedMatches += 1;
      }),
    );

    return finishWithLog(supabase, startedAt, {
      status: "synced",
      reason: "active_match_window",
      provider,
      externalRequests: expectedExternalRequests,
      updatedMatches,
      activeMatches: mappedActiveMatches.length,
      activeMatchdays,
      liveFixtures: fixtures.filter((fixture) =>
        isLiveMatchStatus(fixture.statusShort),
      ).length,
      nextRecommendedSyncInMinutes,
    });
  } catch (error) {
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
