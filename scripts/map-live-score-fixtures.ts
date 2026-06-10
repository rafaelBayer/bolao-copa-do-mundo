import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fetchApiFootballFixturesByCompetition } from "../lib/scores/providers/apiFootball";
import { fetchFootballDataMatches } from "../lib/scores/providers/footballData";
import type { LiveScoreFixture } from "../lib/scores/providers/types";

const TIMEZONE = "America/Sao_Paulo";

type LiveScoreProvider = "api-football" | "football-data" | "manual";

type MappingDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: {
          api_football_fixture_id?: number | null;
          score_provider?: string | null;
          score_provider_fixture_id?: string | null;
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
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  home_team: {
    name: string;
  } | null;
  away_team: {
    name: string;
  } | null;
};

type MappingSupabaseClient = SupabaseClient<MappingDatabase>;

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  content.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  });
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function currentProvider(): LiveScoreProvider {
  const provider = process.env.LIVE_SCORE_PROVIDER?.trim() || "api-football";

  if (
    provider === "api-football" ||
    provider === "football-data" ||
    provider === "manual"
  ) {
    return provider;
  }

  throw new Error(
    `Invalid LIVE_SCORE_PROVIDER: ${provider}. Use api-football, football-data or manual.`,
  );
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

async function fetchMatches(supabase: MappingSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      api_football_fixture_id,
      score_provider,
      score_provider_fixture_id,
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

async function fetchProviderFixtures(provider: LiveScoreProvider) {
  if (provider === "manual") {
    return [];
  }

  if (provider === "football-data") {
    return fetchFootballDataMatches();
  }

  return fetchApiFootballFixturesByCompetition();
}

function findFixtureCandidates(match: MatchRow, fixtures: LiveScoreFixture[]) {
  if (!match.kickoff_at) {
    return [];
  }

  const matchDate = datePartInTimezone(new Date(match.kickoff_at), TIMEZONE);
  const homeName = normalizeName(match.home_team?.name);
  const awayName = normalizeName(match.away_team?.name);

  return fixtures.filter((fixture) => {
    if (!fixture.utcDate) {
      return false;
    }

    const fixtureDate = datePartInTimezone(new Date(fixture.utcDate), TIMEZONE);
    const fixtureHomeName = normalizeName(fixture.homeTeamName);
    const fixtureAwayName = normalizeName(fixture.awayTeamName);

    return (
      fixtureDate === matchDate &&
      fixtureHomeName === homeName &&
      fixtureAwayName === awayName
    );
  });
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const dryRun = process.argv.includes("--dry-run");
  const provider = currentProvider();

  console.log(`Live score provider: ${provider}`);

  if (provider === "manual") {
    console.log("Manual provider selected. No fixture mapping is needed.");
    return;
  }

  console.log("Fetching provider fixtures...");
  const fixtures = await fetchProviderFixtures(provider);
  console.log(`Fixtures returned: ${fixtures.length}`);

  const supabase = createClient<MappingDatabase>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
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
    if (
      match.score_provider === provider &&
      match.score_provider_fixture_id
    ) {
      continue;
    }

    const candidates = findFixtureCandidates(match, fixtures);
    const fixture = candidates.length === 1 ? candidates[0] : null;

    if (!fixture) {
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
      `${dryRun ? "Would map" : "Mapping"}: ${match.home_team?.name} x ${match.away_team?.name} -> ${provider}:${fixture.providerFixtureId}`,
    );

    if (!dryRun) {
      const update =
        provider === "api-football"
          ? {
              api_football_fixture_id: Number(fixture.providerFixtureId),
              score_provider: provider,
              score_provider_fixture_id: String(fixture.providerFixtureId),
            }
          : {
              score_provider: provider,
              score_provider_fixture_id: String(fixture.providerFixtureId),
            };

      const { error } = await supabase
        .from("matches")
        .update(update)
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
  console.error("Live score fixture mapping failed.");
  console.error(error);
  process.exitCode = 1;
});
