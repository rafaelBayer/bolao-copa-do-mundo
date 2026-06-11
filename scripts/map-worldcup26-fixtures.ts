import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import {
  fetchWorldcup26Games,
  mapWorldcup26GameToInternalScore,
  worldcup26TeamsMatch,
  type Worldcup26Game,
} from "../lib/scores/providers/worldcup26";

type MappingDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: {
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
  round_number: number | null;
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  group: {
    name: string;
  } | null;
  home_team: {
    name: string;
    code: string | null;
  } | null;
  away_team: {
    name: string;
    code: string | null;
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
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function fetchMatches(supabase: MappingSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      round_number,
      score_provider,
      score_provider_fixture_id,
      group:groups!matches_group_id_fkey(name),
      home_team:teams!matches_home_team_id_fkey(name, code),
      away_team:teams!matches_away_team_id_fkey(name, code)
    `,
    )
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MatchRow[];
}

function findCandidates(match: MatchRow, games: Worldcup26Game[]) {
  return games.filter((game) => {
    const fixture = mapWorldcup26GameToInternalScore(game);

    if (!fixture) {
      return false;
    }

    return worldcup26TeamsMatch({
      localHomeName: match.home_team?.name,
      localAwayName: match.away_team?.name,
      providerHomeName: fixture.homeTeamName,
      providerAwayName: fixture.awayTeamName,
    });
  });
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const dryRun = process.argv.includes("--dry-run");
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

  console.log("Fetching worldcup26 games...");
  const games = await fetchWorldcup26Games();
  console.log(`Total API: ${games.length}`);

  console.log("Fetching local matches...");
  const matches = await fetchMatches(supabase);
  console.log(`Total local: ${matches.length}`);

  let mapped = 0;
  let pending = 0;
  let ambiguous = 0;

  for (const match of matches) {
    const candidates = findCandidates(match, games);
    const game = candidates.length === 1 ? candidates[0] : null;
    const fixture = game ? mapWorldcup26GameToInternalScore(game) : null;

    if (!fixture) {
      if (candidates.length > 1) {
        ambiguous += 1;
        console.log(
          `Ambiguous: ${match.home_team?.name} x ${match.away_team?.name} - ${candidates.length} candidates`,
        );
      } else {
        pending += 1;
        console.log(
          `Pending: ${match.home_team?.name} x ${match.away_team?.name}`,
        );
      }

      continue;
    }

    mapped += 1;
    console.log(
      `${dryRun ? "Would map" : "Mapping"}: ${match.home_team?.name} x ${match.away_team?.name} -> worldcup26:${fixture.providerFixtureId}`,
    );

    if (
      !dryRun &&
      (match.score_provider !== "worldcup26" ||
        match.score_provider_fixture_id !== String(fixture.providerFixtureId))
    ) {
      const { error } = await supabase
        .from("matches")
        .update({
          score_provider: "worldcup26",
          score_provider_fixture_id: String(fixture.providerFixtureId),
        })
        .eq("id", match.id);

      if (error) {
        throw error;
      }
    }
  }

  console.log("Done.");
  console.log(`Mapped: ${mapped}`);
  console.log(`Pending: ${pending}`);
  console.log(`Ambiguous: ${ambiguous}`);

  if (dryRun) {
    console.log("Dry-run: no database changes applied.");
  }
}

main().catch((error: unknown) => {
  console.error("worldcup26 fixture mapping failed.");
  console.error(error);
  process.exitCode = 1;
});
