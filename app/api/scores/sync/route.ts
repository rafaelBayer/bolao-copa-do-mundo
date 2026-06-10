import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchApiFootballFixturesByDate } from "@/lib/scores/providers/apiFootball";
import { fetchFootballDataMatches } from "@/lib/scores/providers/footballData";
import type { LiveScoreFixture } from "@/lib/scores/providers/types";
import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";

export const dynamic = "force-dynamic";

const TIMEZONE = "America/Sao_Paulo";
const ACTIVE_WINDOW_BEFORE_MINUTES = 5;
const ACTIVE_WINDOW_AFTER_MINUTES = 135;
const HALFTIME_PAUSE_MINUTES = 15;

type LiveScoreProvider = "api-football" | "football-data" | "manual";

type SyncDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: Partial<MatchUpdate>;
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
};

type SyncSupabaseClient = SupabaseClient<SyncDatabase>;

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function validateSecret(request: NextRequest) {
  const expectedSecret = process.env.SCORES_SYNC_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-sync-secret");

  return Boolean(expectedSecret && providedSecret === expectedSecret);
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

async function fetchMatches(supabase: SyncSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "kickoff_at",
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

  if (match.score_provider !== provider) {
    return null;
  }

  return match.score_provider_fixture_id;
}

async function fetchProviderFixtures(
  provider: LiveScoreProvider,
  today: string,
) {
  if (provider === "football-data") {
    return fetchFootballDataMatches();
  }

  return fetchApiFootballFixturesByDate({
    date: today,
    timezone: TIMEZONE,
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

export async function GET(request: NextRequest) {
  if (!validateSecret(request)) {
    return jsonResponse({ status: "error", reason: "unauthorized" }, 401);
  }

  const provider = currentProvider();

  if (provider === "manual") {
    return jsonResponse({
      status: "skipped",
      reason: "manual_provider",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
    });
  }

  if (provider === "api-football" && !process.env.API_FOOTBALL_KEY) {
    return jsonResponse({
      status: "skipped",
      reason: "missing_api_key",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
    });
  }

  if (provider === "football-data" && !process.env.FOOTBALL_DATA_API_KEY) {
    return jsonResponse({
      status: "skipped",
      reason: "missing_football_data_api_key",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
    });
  }

  let supabase: SyncSupabaseClient;

  try {
    supabase = createServiceClient();
  } catch (error) {
    return jsonResponse(
      {
        status: "error",
        reason: "missing_supabase_server_env",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
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
    isWithinActiveWindow(match, now),
  );
  const kickoffTimes = new Set(
    todayMatches
      .filter((match) => match.kickoff_at)
      .map((match) => timePartInTimezone(new Date(match.kickoff_at as string), TIMEZONE)),
  );
  const nextRecommendedSyncInMinutes = syncIntervalForKickoffTimes(
    kickoffTimes.size,
  );

  if (activeMatches.length === 0) {
    return jsonResponse({
      status: "skipped",
      reason: "outside_active_window",
      externalRequests: 0,
      updatedMatches: 0,
      nextRecommendedSyncInMinutes,
    });
  }

  const mappedActiveMatches = activeMatches.filter(
    (match) => providerFixtureIdForMatch(match, provider) !== null,
  );

  if (mappedActiveMatches.length === 0) {
    return jsonResponse({
      status: "skipped",
      reason: "missing_fixture_mapping",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
      activeMatches: activeMatches.length,
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
    return jsonResponse({
      status: "skipped",
      reason: "halftime_pause",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
      nextRecommendedSyncInMinutes,
    });
  }

  const latestUpdate = latestScoreUpdate(mappedActiveMatches);

  if (
    latestUpdate &&
    minutesSince(latestUpdate, now) < nextRecommendedSyncInMinutes
  ) {
    return jsonResponse({
      status: "skipped",
      reason: "minimum_interval_not_reached",
      provider,
      externalRequests: 0,
      updatedMatches: 0,
      nextRecommendedSyncInMinutes,
    });
  }

  let fixtures: LiveScoreFixture[];

  try {
    fixtures = await fetchProviderFixtures(provider, today);
  } catch (error) {
    return jsonResponse(
      {
        status: "error",
        reason: "provider_error",
        provider,
        externalRequests: 1,
        updatedMatches: 0,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      502,
    );
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

  return jsonResponse({
    status: "synced",
    reason: "active_match_window",
    provider,
    externalRequests: 1,
    updatedMatches,
    liveFixtures: fixtures.filter((fixture) =>
      isLiveMatchStatus(fixture.statusShort),
    ).length,
    nextRecommendedSyncInMinutes,
  });
}
