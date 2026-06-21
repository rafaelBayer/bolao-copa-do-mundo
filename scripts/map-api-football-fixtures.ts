import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getScriptSupabaseConfig,
  loadScriptEnvFiles,
  logScriptSupabaseTarget,
} from "../lib/supabase/scriptEnv";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const TIMEZONE = "America/Sao_Paulo";
const DEFAULT_WORLD_CUP_LEAGUE_ID = "1";
const DEFAULT_WORLD_CUP_SEASON = "2026";

type MappingDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: {
          api_football_fixture_id?: number | null;
        };
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
  home_team: {
    name: string;
  } | null;
  away_team: {
    name: string;
  } | null;
};

type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
  } | null;
  league?: {
    id?: number | null;
    name?: string | null;
    season?: number | null;
  } | null;
  teams?: {
    home?: {
      name?: string | null;
    } | null;
    away?: {
      name?: string | null;
    } | null;
  } | null;
};

type ApiFootballResponse = {
  errors?: unknown;
  results?: number;
  paging?: unknown;
  message?: string;
  response?: ApiFootballFixture[];
};

type MappingSupabaseClient = SupabaseClient<MappingDatabase>;

function optionalEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();

  return value || fallback;
}

function requiredApiFootballKey() {
  const value = process.env.API_FOOTBALL_KEY?.trim();

  if (!value) {
    throw new Error(
      "Missing API_FOOTBALL_KEY. Add it to .env.local before running this script.",
    );
  }

  return value;
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function hasApiErrors(errors: unknown) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return true;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey.includes("key") ||
        normalizedKey.includes("token") ||
        normalizedKey.includes("email")
      ) {
        return [key, "[redacted]"];
      }

      return [key, redactSensitive(nestedValue)];
    }),
  );
}

function endpointLabel(url: URL) {
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function logApiRequest(url: URL, leagueId: string, season: string) {
  console.log(`League: ${leagueId}`);
  console.log(`Season: ${season}`);
  console.log(`Endpoint: ${endpointLabel(url)}`);
}

function logApiPayloadDiagnostics(
  payload: ApiFootballResponse,
  status: number,
) {
  console.error("API-Football returned errors:");
  console.error(`HTTP status: ${status}`);

  if (payload.errors !== undefined) {
    console.error("Errors:");
    console.error(formatJson(payload.errors));
  }

  if (payload.message) {
    console.error("Message:");
    console.error(payload.message);
  }

  if (payload.results !== undefined) {
    console.error(`Results: ${payload.results}`);
  }

  if (payload.paging !== undefined) {
    console.error("Paging:");
    console.error(formatJson(payload.paging));
  }
}

function logDebugFixtures(fixtures: ApiFootballFixture[]) {
  console.log(`Fixtures returned: ${fixtures.length}`);
  console.log("First fixtures:");
  fixtures.slice(0, 3).forEach((fixture, index) => {
    console.log(
      formatJson({
        index: index + 1,
        fixtureId: fixture.fixture?.id ?? null,
        date: fixture.fixture?.date ?? null,
        homeTeam: fixture.teams?.home?.name ?? null,
        awayTeam: fixture.teams?.away?.name ?? null,
        leagueId: fixture.league?.id ?? null,
        leagueName: fixture.league?.name ?? null,
        season: fixture.league?.season ?? null,
      }),
    );
  });
}

async function fetchApiFootballStatus(apiKey: string) {
  const url = new URL("/status", API_FOOTBALL_BASE_URL);
  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  console.error("API-Football status diagnostics:");
  console.error(`HTTP status: ${response.status}`);
  console.error(formatJson(redactSensitive(payload)));
}

async function fetchApiFootballFixtures(debug: boolean) {
  const apiKey = requiredApiFootballKey();
  const leagueId = optionalEnv(
    "API_FOOTBALL_WORLD_CUP_LEAGUE_ID",
    DEFAULT_WORLD_CUP_LEAGUE_ID,
  );
  const season = optionalEnv(
    "API_FOOTBALL_WORLD_CUP_SEASON",
    DEFAULT_WORLD_CUP_SEASON,
  );
  const url = new URL("/fixtures", API_FOOTBALL_BASE_URL);
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);
  url.searchParams.set("timezone", TIMEZONE);

  logApiRequest(url, leagueId, season);

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiFootballResponse
    | null;

  if (!response.ok) {
    console.error("API-Football request failed:");
    console.error(`HTTP status: ${response.status}`);

    if (payload) {
      console.error("Response:");
      console.error(formatJson({
        errors: payload.errors,
        results: payload.results,
        paging: payload.paging,
        message: payload.message,
      }));
    }

    throw new Error(`API-Football request failed: ${response.status}`);
  }

  if (!payload) {
    throw new Error("API-Football returned an empty or invalid JSON response.");
  }

  if (hasApiErrors(payload.errors)) {
    logApiPayloadDiagnostics(payload, response.status);

    if (debug) {
      await fetchApiFootballStatus(apiKey);
    }

    throw new Error(
      `API-Football returned errors: ${formatJson(payload.errors)}`,
    );
  }

  if (debug) {
    console.log(`HTTP status: ${response.status}`);
    console.log(`Results: ${payload.results ?? "(not provided)"}`);
    if (payload.paging !== undefined) {
      console.log("Paging:");
      console.log(formatJson(payload.paging));
    }
    logDebugFixtures(payload.response ?? []);
  }

  return payload.response ?? [];
}

async function fetchMatches(supabase: MappingSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      api_football_fixture_id,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name)
    `,
    )
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MatchRow[];
}

function findFixtureCandidates(match: MatchRow, fixtures: ApiFootballFixture[]) {
  if (!match.kickoff_at) {
    return [];
  }

  const matchDate = datePartInTimezone(new Date(match.kickoff_at), TIMEZONE);
  const homeName = normalizeName(match.home_team?.name);
  const awayName = normalizeName(match.away_team?.name);

  return fixtures.filter((fixture) => {
    if (!fixture.fixture?.date) {
      return false;
    }

    const fixtureDate = datePartInTimezone(
      new Date(fixture.fixture.date),
      TIMEZONE,
    );
    const fixtureHomeName = normalizeName(fixture.teams?.home?.name);
    const fixtureAwayName = normalizeName(fixture.teams?.away?.name);

    return (
      fixtureDate === matchDate &&
      fixtureHomeName === homeName &&
      fixtureAwayName === awayName
    );
  });
}

async function main() {
  loadScriptEnvFiles();

  const dryRun = process.argv.includes("--dry-run");
  const supabaseConfig = getScriptSupabaseConfig();
  const debug =
    process.argv.includes("--debug") ||
    process.env.DEBUG_API_FOOTBALL === "true";

  logScriptSupabaseTarget("API-Football fixture mapping", supabaseConfig, dryRun);
  console.log("Fetching API-Football fixtures...");
  const fixtures = await fetchApiFootballFixtures(debug);
  console.log(`Fixtures returned: ${fixtures.length}`);

  const supabase = createClient<MappingDatabase>(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  console.log("Fetching local matches...");
  const matches = await fetchMatches(supabase);
  console.log(`Local matches: ${matches.length}`);

  let safeMatches = 0;
  let updatedMatches = 0;
  let missingMatches = 0;
  let ambiguousMatches = 0;

  for (const match of matches) {
    if (match.api_football_fixture_id) {
      continue;
    }

    const candidates = findFixtureCandidates(match, fixtures);
    const fixture = candidates.length === 1 ? candidates[0] : null;

    if (!fixture?.fixture?.id) {
      if (candidates.length > 1) {
        ambiguousMatches += 1;
        console.log(
          `Ambiguous match: ${match.home_team?.name} x ${match.away_team?.name} (${match.kickoff_at}) - ${candidates.length} candidates`,
        );
        continue;
      }

      missingMatches += 1;
      console.log(
        `No safe match: ${match.home_team?.name} x ${match.away_team?.name} (${match.kickoff_at})`,
      );
      continue;
    }

    safeMatches += 1;
    console.log(
      `${dryRun ? "Would map" : "Mapping"}: ${match.home_team?.name} x ${match.away_team?.name} -> fixture ${fixture.fixture.id}`,
    );

    if (!dryRun) {
      const { error } = await supabase
        .from("matches")
        .update({ api_football_fixture_id: fixture.fixture.id })
        .eq("id", match.id);

      if (error) {
        throw error;
      }

      updatedMatches += 1;
    }
  }

  console.log("Done.");
  console.log(`Safe matches: ${safeMatches}`);
  console.log(`Ambiguous matches: ${ambiguousMatches}`);
  console.log(`Missing matches: ${missingMatches}`);
  console.log(`Updated matches: ${updatedMatches}`);
  if (dryRun) {
    console.log("Dry-run: no database changes applied.");
  }
}

main().catch((error: unknown) => {
  console.error("Fixture mapping failed.");
  console.error(error);
  process.exitCode = 1;
});
