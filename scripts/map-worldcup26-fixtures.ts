import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchWorldcup26Games,
  mapWorldcup26GameToInternalScore,
  worldcup26TeamsMatch,
  type Worldcup26Game,
} from "../lib/scores/providers/worldcup26";
import {
  getScriptSupabaseConfig,
  loadScriptEnvFiles,
  logScriptSupabaseTarget,
} from "../lib/supabase/scriptEnv";

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

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);

  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeGroup(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^grupo\s+/, "")
    .replace(/^group\s+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
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

    const sameTeams = worldcup26TeamsMatch({
      localHomeName: match.home_team?.name,
      localAwayName: match.away_team?.name,
      providerHomeName: fixture.homeTeamName,
      providerAwayName: fixture.awayTeamName,
    });

    if (!sameTeams) {
      return false;
    }

    const localGroup = normalizeGroup(match.group?.name);
    const providerGroup = normalizeGroup(stringValue(game.group));
    const localMatchday = match.round_number;
    const providerMatchday = numberValue(game.matchday);

    return (
      (!localGroup || !providerGroup || localGroup === providerGroup) &&
      (localMatchday === null ||
        providerMatchday === null ||
        localMatchday === providerMatchday)
    );
  });
}

async function main() {
  loadScriptEnvFiles();

  const dryRun = process.argv.includes("--dry-run");
  const supabaseConfig = getScriptSupabaseConfig();
  logScriptSupabaseTarget("worldcup26 fixture mapping", supabaseConfig, dryRun);

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

  console.log("Fetching worldcup26 games...");
  const games = await fetchWorldcup26Games();
  console.log(`Total API: ${games.length}`);

  console.log("Fetching local matches...");
  const matches = await fetchMatches(supabase);
  console.log(`Total local: ${matches.length}`);

  let mapped = 0;
  let alreadyMapped = 0;
  let updatedMatches = 0;
  let pending = 0;
  let ambiguous = 0;
  let conflicts = 0;
  let mappedBefore = 0;
  const pendingLabels: string[] = [];
  const conflictLabels: string[] = [];

  for (const match of matches) {
    if (
      match.score_provider === "worldcup26" &&
      match.score_provider_fixture_id
    ) {
      mappedBefore += 1;
    }

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
        pendingLabels.push(
          `${match.home_team?.name} x ${match.away_team?.name} (${match.group?.name ?? "sem grupo"}, rodada ${match.round_number ?? "-"})`,
        );
        console.log(
          `Pending: ${match.home_team?.name} x ${match.away_team?.name}`,
        );
      }

      continue;
    }

    mapped += 1;

    if (
      match.score_provider === "worldcup26" &&
      match.score_provider_fixture_id &&
      match.score_provider_fixture_id !== String(fixture.providerFixtureId)
    ) {
      conflicts += 1;
      conflictLabels.push(
        `${match.home_team?.name} x ${match.away_team?.name}: local=${match.score_provider_fixture_id}, candidate=${fixture.providerFixtureId}`,
      );
      console.log(
        `Conflict: ${match.home_team?.name} x ${match.away_team?.name} is mapped to ${match.score_provider_fixture_id}, candidate is ${fixture.providerFixtureId}`,
      );
      continue;
    }

    if (
      match.score_provider === "worldcup26" &&
      match.score_provider_fixture_id === String(fixture.providerFixtureId)
    ) {
      alreadyMapped += 1;
    }

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

      updatedMatches += 1;
    }
  }

  console.log("Done.");
  console.log(`Mapped before: ${mappedBefore}`);
  console.log(`Mapped: ${mapped}`);
  console.log(`Already mapped: ${alreadyMapped}`);
  console.log(`Updated matches: ${updatedMatches}`);
  console.log(`Pending: ${pending}`);
  console.log(`Ambiguous: ${ambiguous}`);
  console.log(`Conflicts: ${conflicts}`);

  if (pendingLabels.length > 0) {
    console.log("Pending matches:");
    pendingLabels.forEach((label) => console.log(`- ${label}`));
  }

  if (conflictLabels.length > 0) {
    console.log("Conflicts:");
    conflictLabels.forEach((label) => console.log(`- ${label}`));
  }

  if (dryRun) {
    console.log("Dry-run: no database changes applied.");
  }
}

main().catch((error: unknown) => {
  console.error("worldcup26 fixture mapping failed.");
  console.error(error);
  process.exitCode = 1;
});
