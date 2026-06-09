import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { worldCup2026Data } from "../data/world-cup-2026";
import { validateWorldCupData } from "../lib/world-cup/validateWorldCupData";
import type {
  WorldCupGroupSeed,
  WorldCupMatchSeed,
  WorldCupTeamSeed,
} from "../types/worldCupData";

type ImportDatabase = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          code: string | null;
        };
        Insert: {
          name: string;
          code: string;
          flag_url: string | null;
        };
        Update: Partial<ImportDatabase["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          name: string;
        };
        Update: Partial<ImportDatabase["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [];
      };
      group_teams: {
        Row: {
          id: string;
        };
        Insert: {
          group_id: string;
          team_id: string;
          position: number;
        };
        Update: Partial<
          ImportDatabase["public"]["Tables"]["group_teams"]["Insert"]
        >;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
        };
        Insert: {
          fifa_match_number: number | null;
          group_id: string;
          home_team_id: string;
          away_team_id: string;
          round_number: number;
          match_date: string | null;
          kickoff_at: string | null;
          stadium: string | null;
          city: string | null;
          country: string | null;
        };
        Update: Partial<
          ImportDatabase["public"]["Tables"]["matches"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type ImportSupabaseClient = SupabaseClient<ImportDatabase>;

type IdByKey = Map<string, string>;

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

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function allTeams(groups: WorldCupGroupSeed[]) {
  return groups.flatMap((group) => group.teams);
}

function groupTeamLinks(groups: WorldCupGroupSeed[]) {
  return groups.flatMap((group) => group.teams);
}

async function upsertTeams(
  supabase: ImportSupabaseClient,
  teams: WorldCupTeamSeed[],
) {
  if (teams.length === 0) {
    return {
      count: 0,
      ids: new Map<string, string>(),
    };
  }

  const payload = teams.map((team) => ({
    name: team.name,
    code: normalizeCode(team.code),
    flag_url: team.flagUrl ?? null,
  }));

  const { data, error } = await supabase
    .from("teams")
    .upsert(payload, { onConflict: "code" })
    .select("id, code");

  if (error) {
    throw error;
  }

  const ids = new Map<string, string>();
  data?.forEach((team) => {
    ids.set(String(team.code), String(team.id));
  });

  return {
    count: payload.length,
    ids,
  };
}

async function upsertGroups(
  supabase: ImportSupabaseClient,
  groups: WorldCupGroupSeed[],
) {
  if (groups.length === 0) {
    return {
      count: 0,
      ids: new Map<string, string>(),
    };
  }

  const payload = groups.map((group) => ({
    name: group.name,
  }));

  const { data, error } = await supabase
    .from("groups")
    .upsert(payload, { onConflict: "name" })
    .select("id, name");

  if (error) {
    throw error;
  }

  const ids = new Map<string, string>();
  data?.forEach((group) => {
    ids.set(String(group.name), String(group.id));
  });

  return {
    count: payload.length,
    ids,
  };
}

async function upsertGroupTeams(
  supabase: ImportSupabaseClient,
  groups: WorldCupGroupSeed[],
  groupIds: IdByKey,
  teamIds: IdByKey,
) {
  const payload = groups.flatMap((group) => {
    const groupId = groupIds.get(group.name);

    if (!groupId) {
      throw new Error(`Group id not found: ${group.name}`);
    }

    return group.teams.map((team, index) => {
      const teamCode = normalizeCode(team.code);
      const teamId = teamIds.get(teamCode);

      if (!teamId) {
        throw new Error(`Team id not found: ${teamCode}`);
      }

      return {
        group_id: groupId,
        team_id: teamId,
        position: index + 1,
      };
    });
  });

  if (payload.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("group_teams")
    .upsert(payload, { onConflict: "group_id,team_id" });

  if (error) {
    throw error;
  }

  return payload.length;
}

function matchPayload(
  match: WorldCupMatchSeed,
  groupId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  return {
    fifa_match_number: match.fifaMatchNumber ?? null,
    group_id: groupId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    round_number: match.roundNumber,
    match_date: match.kickoffAt ?? null,
    kickoff_at: match.kickoffAt ?? null,
    stadium: match.stadium ?? null,
    city: match.city ?? null,
    country: match.country ?? null,
  };
}

async function upsertMatches(
  supabase: ImportSupabaseClient,
  groups: WorldCupGroupSeed[],
  groupIds: IdByKey,
  teamIds: IdByKey,
) {
  const payload = groups.flatMap((group) => {
    const groupId = groupIds.get(group.name);

    if (!groupId) {
      throw new Error(`Group id not found: ${group.name}`);
    }

    return group.matches.map((match) => {
      const homeTeamCode = normalizeCode(match.homeTeamCode);
      const awayTeamCode = normalizeCode(match.awayTeamCode);
      const homeTeamId = teamIds.get(homeTeamCode);
      const awayTeamId = teamIds.get(awayTeamCode);

      if (!homeTeamId) {
        throw new Error(`Home team id not found: ${homeTeamCode}`);
      }

      if (!awayTeamId) {
        throw new Error(`Away team id not found: ${awayTeamCode}`);
      }

      return matchPayload(match, groupId, homeTeamId, awayTeamId);
    });
  });

  if (payload.length === 0) {
    return 0;
  }

  const withFifaNumber = payload.filter(
    (match) => match.fifa_match_number !== null,
  );
  const withoutFifaNumber = payload.filter(
    (match) => match.fifa_match_number === null,
  );

  if (withFifaNumber.length > 0) {
    const { error } = await supabase
      .from("matches")
      .upsert(withFifaNumber, { onConflict: "fifa_match_number" });

    if (error) {
      throw error;
    }
  }

  if (withoutFifaNumber.length > 0) {
    const { error } = await supabase.from("matches").upsert(withoutFifaNumber, {
      onConflict: "group_id,home_team_id,away_team_id,round_number",
    });

    if (error) {
      throw error;
    }
  }

  return payload.length;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("Validating data...");
  const validation = validateWorldCupData(worldCup2026Data);

  if (!validation.valid) {
    console.error("Validation failed.");
    validation.errors.forEach((error) => {
      console.error(`- ${error}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed.");

  if (dryRun) {
    console.log("Dry run enabled. No data will be written to Supabase.");
    console.log(`Teams to import/update: ${validation.summary.teams}`);
    console.log(`Groups to import/update: ${validation.summary.groups}`);
    console.log(
      `Group/team links to import/update: ${groupTeamLinks(worldCup2026Data.groups).length}`,
    );
    console.log(`Matches to import/update: ${validation.summary.matches}`);
    console.log("Done.");
    return;
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<ImportDatabase>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("Importing teams...");
  const teams = allTeams(worldCup2026Data.groups);
  const teamsImport = await upsertTeams(supabase, teams);
  console.log(`${teamsImport.count} teams imported/updated.`);

  console.log("Importing groups...");
  const groupsImport = await upsertGroups(supabase, worldCup2026Data.groups);
  console.log(`${groupsImport.count} groups imported/updated.`);

  console.log("Importing group teams...");
  const groupTeamsCount = await upsertGroupTeams(
    supabase,
    worldCup2026Data.groups,
    groupsImport.ids,
    teamsImport.ids,
  );
  console.log(`${groupTeamsCount} group/team links imported/updated.`);

  console.log("Importing matches...");
  const matchesCount = await upsertMatches(
    supabase,
    worldCup2026Data.groups,
    groupsImport.ids,
    teamsImport.ids,
  );
  console.log(`${matchesCount} matches imported/updated.`);

  console.log("Done.");
  console.log(
    `World Cup import finished: ${worldCup2026Data.tournament} (${worldCup2026Data.updatedAt}).`,
  );
}

main().catch((error: unknown) => {
  console.error("World Cup import failed.");
  console.error(error);
  process.exitCode = 1;
});
