import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateGroupStandings } from "../lib/groups/calculateGroupStandings";
import {
  KNOCKOUT_TOURNAMENT_KEY,
  ROUND_OF_32_POSITIONS,
} from "../lib/knockout/bracketStructure";
import {
  isScoreDryRunEnabled,
  logScoreSupabaseTarget,
  logScoreSupabaseTargets,
  resolveScoreSupabaseEnvs,
  type ScoreSupabaseConfig,
} from "../lib/scores/resolveScoreSupabaseEnv";
import type { GroupWithTeamsAndMatches } from "../types/group";
import type { MatchWithTeams, Team } from "../types/match";

type KnockoutSyncDatabase = {
  public: {
    Tables: {
      groups: {
        Row: GroupRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knockout_settings: {
        Row: KnockoutSettingsRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knockout_matches: {
        Row: KnockoutMatchRow;
        Insert: KnockoutMatchUpsert;
        Update: KnockoutMatchUpsert;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type GroupRow = {
  id: string;
  name: string;
  group_teams: {
    position: number | null;
    team: TeamRow | TeamRow[] | null;
  }[];
  matches: MatchRow[];
};

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
  flag_url: string | null;
};

type MatchRow = {
  id: string;
  group_id: string;
  fifa_match_number: number | null;
  round_number: number | null;
  match_date: string | null;
  kickoff_at: string | null;
  stadium: string | null;
  city: string | null;
  country: string | null;
  home_score: number | null;
  away_score: number | null;
  api_football_fixture_id: number | null;
  status_short: string | null;
  status_long: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  score_updated_at: string | null;
  home_team: TeamRow | TeamRow[] | null;
  away_team: TeamRow | TeamRow[] | null;
};

type KnockoutSettingsRow = {
  id: string;
  tournament_key: string;
  is_active: boolean;
};

type KnockoutMatchRow = {
  id: string;
  tournament_key: string;
  round: "round_of_32";
  position: number;
  external_match_id: string | null;
  team_a_source: string | null;
  team_a: string | null;
  team_a_code: string | null;
  team_a_flag_url: string | null;
  team_b_source: string | null;
  team_b: string | null;
  team_b_code: string | null;
  team_b_flag_url: string | null;
  starts_at: string | null;
  winner_team: string | null;
  winner_team_code: string | null;
};

type KnockoutMatchUpsert = Omit<KnockoutMatchRow, "id">;

type KnockoutSupabaseClient = SupabaseClient<KnockoutSyncDatabase>;

type GroupSummary = {
  groupKey: string;
  group: GroupWithTeamsAndMatches;
  complete: boolean;
  countedMatches: number;
  expectedMatches: number;
  standings: ReturnType<typeof calculateGroupStandings>["standings"];
};

type TeamSelection = {
  name: string | null;
  code: string | null;
  flagUrl: string | null;
};

type ResolvedSlot = {
  team: TeamSelection;
  pendingReason: string | null;
};

type SourceSpec =
  | {
      kind: "group-rank";
      groupKey: string;
      rank: number;
    }
  | {
      kind: "best-third";
      rank: number;
    };

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg?.slice(prefix.length).trim() || null;
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeGroupKey(value: string) {
  const match = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/\b([A-L])\b/);

  return match?.[1] ?? value.trim().toUpperCase();
}

function mapTeam(row: TeamRow | TeamRow[] | null): Team | null {
  const team = single(row);

  if (!team) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
    code: team.code,
    flagUrl: team.flag_url,
  };
}

function mapMatch(row: MatchRow): MatchWithTeams | null {
  const homeTeam = mapTeam(row.home_team);
  const awayTeam = mapTeam(row.away_team);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return {
    id: row.id,
    groupId: row.group_id,
    fifaMatchNumber: row.fifa_match_number,
    roundNumber: row.round_number ?? 0,
    matchDate: row.match_date,
    kickoffAt: row.kickoff_at,
    stadium: row.stadium,
    city: row.city,
    country: row.country,
    homeScore: row.home_score,
    awayScore: row.away_score,
    apiFootballFixtureId: row.api_football_fixture_id,
    statusShort: row.status_short,
    statusLong: row.status_long,
    elapsed: row.elapsed,
    homeScoreLive: row.home_score_live,
    awayScoreLive: row.away_score_live,
    scoreUpdatedAt: row.score_updated_at,
    goals: [],
    homeTeam,
    awayTeam,
  };
}

function mapGroup(row: GroupRow): GroupWithTeamsAndMatches {
  return {
    id: row.id,
    name: row.name,
    teams: (row.group_teams ?? [])
      .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
      .map((groupTeam) => mapTeam(groupTeam.team))
      .filter((team): team is Team => Boolean(team)),
    matches: (row.matches ?? [])
      .map(mapMatch)
      .filter((match): match is MatchWithTeams => Boolean(match))
      .sort((left, right) => left.roundNumber - right.roundNumber),
  };
}

function expectedGroupMatches(teamCount: number) {
  return teamCount > 1 ? (teamCount * (teamCount - 1)) / 2 : 0;
}

function buildGroupSummaries(groups: GroupWithTeamsAndMatches[]) {
  return new Map(
    groups.map((group) => {
      const scoresByMatchId = new Map(
        group.matches.map((match) => [
          match.id,
          {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
          },
        ]),
      );
      const result = calculateGroupStandings({
        teams: group.teams,
        matches: group.matches,
        scoresByMatchId,
      });
      const expectedMatches = expectedGroupMatches(group.teams.length);
      const groupKey = normalizeGroupKey(group.name);

      return [
        groupKey,
        {
          groupKey,
          group,
          complete:
            expectedMatches > 0 && result.countedMatches >= expectedMatches,
          countedMatches: result.countedMatches,
          expectedMatches,
          standings: result.standings,
        },
      ];
    }),
  );
}

function parseSource(source: string | null): SourceSpec | null {
  const value = source?.trim().toUpperCase();

  if (!value || value === "TBD" || value === "A DEFINIR") {
    return null;
  }

  const groupRank = value.match(/^GROUP[_ -]?([A-L])[_ -]?([1-3])$/) ??
    value.match(/^([A-L])([1-3])$/);

  if (groupRank?.[1] && groupRank[2]) {
    return {
      kind: "group-rank",
      groupKey: groupRank[1],
      rank: Number(groupRank[2]),
    };
  }

  const bestThird =
    value.match(/^BEST(?:[_ -]?THIRD|3)[:_ -]?([1-8])$/) ??
    value.match(/^MELHOR(?:ES)?[_ -]?3[:_ -]?([1-8])$/);

  if (bestThird?.[1]) {
    return {
      kind: "best-third",
      rank: Number(bestThird[1]),
    };
  }

  return null;
}

function emptyTeam(): TeamSelection {
  return {
    name: null,
    code: null,
    flagUrl: null,
  };
}

function teamFromStanding(
  row: GroupSummary["standings"][number],
): TeamSelection {
  return {
    name: row.teamName,
    code: row.teamCode,
    flagUrl: row.flagUrl,
  };
}

function resolveGroupRank(
  source: SourceSpec & { kind: "group-rank" },
  groupsByKey: Map<string, GroupSummary>,
): ResolvedSlot {
  const group = groupsByKey.get(source.groupKey);

  if (!group) {
    return {
      team: emptyTeam(),
      pendingReason: `group ${source.groupKey} not found`,
    };
  }

  if (!group.complete) {
    return {
      team: emptyTeam(),
      pendingReason: `group ${source.groupKey} pending (${group.countedMatches}/${group.expectedMatches} matches counted)`,
    };
  }

  const row = group.standings[source.rank - 1];

  if (!row) {
    return {
      team: emptyTeam(),
      pendingReason: `group ${source.groupKey} rank ${source.rank} unavailable`,
    };
  }

  return {
    team: teamFromStanding(row),
    pendingReason: null,
  };
}

function resolveBestThird(
  source: SourceSpec & { kind: "best-third" },
  groupsByKey: Map<string, GroupSummary>,
): ResolvedSlot {
  const groups = Array.from(groupsByKey.values());
  const incompleteGroups = groups.filter((group) => !group.complete);

  if (incompleteGroups.length > 0) {
    return {
      team: emptyTeam(),
      pendingReason: `best thirds pending (${incompleteGroups.length} groups incomplete)`,
    };
  }

  const thirds = groups
    .map((group) => group.standings[2])
    .filter((row): row is GroupSummary["standings"][number] => Boolean(row))
    .sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      if (right.goalDifference !== left.goalDifference) {
        return right.goalDifference - left.goalDifference;
      }
      if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
      return left.teamName.localeCompare(right.teamName, "pt-BR");
    });
  const row = thirds[source.rank - 1];

  if (!row) {
    return {
      team: emptyTeam(),
      pendingReason: `best third rank ${source.rank} unavailable`,
    };
  }

  return {
    team: teamFromStanding(row),
    pendingReason: null,
  };
}

function resolveSource(
  source: string | null,
  groupsByKey: Map<string, GroupSummary>,
): ResolvedSlot {
  const sourceSpec = parseSource(source);

  if (!sourceSpec) {
    return {
      team: emptyTeam(),
      pendingReason: source?.trim() ? `unsupported source ${source}` : "source not configured",
    };
  }

  if (sourceSpec.kind === "group-rank") {
    return resolveGroupRank(sourceSpec, groupsByKey);
  }

  return resolveBestThird(sourceSpec, groupsByKey);
}

function teamChanged(current: TeamSelection, next: TeamSelection) {
  return (
    current.name !== next.name ||
    current.code !== next.code ||
    current.flagUrl !== next.flagUrl
  );
}

function sideSelection(row: KnockoutMatchRow | null, side: "a" | "b") {
  return {
    name: side === "a" ? row?.team_a ?? null : row?.team_b ?? null,
    code: side === "a" ? row?.team_a_code ?? null : row?.team_b_code ?? null,
    flagUrl:
      side === "a" ? row?.team_a_flag_url ?? null : row?.team_b_flag_url ?? null,
  };
}

function desiredSide(
  row: KnockoutMatchRow | null,
  side: "a" | "b",
  groupsByKey: Map<string, GroupSummary>,
) {
  const current = sideSelection(row, side);
  const source = side === "a" ? row?.team_a_source ?? null : row?.team_b_source ?? null;

  if (!source?.trim()) {
    return {
      team: current,
      pendingReason: row ? null : "source not configured",
    };
  }

  const resolved = resolveSource(source, groupsByKey);

  if (!resolved.team.name && current.name) {
    return {
      team: current,
      pendingReason: resolved.pendingReason,
    };
  }

  return resolved;
}

function formatTeam(team: TeamSelection) {
  if (!team.name) {
    return "null";
  }

  return `${team.name}${team.code ? ` (${team.code})` : ""}`;
}

function diffSide(label: string, current: TeamSelection, next: TeamSelection) {
  if (!teamChanged(current, next)) {
    return null;
  }

  return `${label}: ${formatTeam(current)} -> ${formatTeam(next)}`;
}

async function fetchGroups(supabase: KnockoutSupabaseClient) {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      name,
      group_teams(
        position,
        team:teams(id, name, code, flag_url)
      ),
      matches(
        id,
        group_id,
        fifa_match_number,
        round_number,
        match_date,
        kickoff_at,
        stadium,
        city,
        country,
        home_score,
        away_score,
        api_football_fixture_id,
        status_short,
        status_long,
        elapsed,
        home_score_live,
        away_score_live,
        score_updated_at,
        home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url),
        away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)
      )
    `,
    )
    .order("name");

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as GroupRow[]).map(mapGroup);
}

async function fetchKnockoutSettings(
  supabase: KnockoutSupabaseClient,
  tournamentKey: string,
) {
  const { data, error } = await supabase
    .from("knockout_settings")
    .select("id, tournament_key, is_active")
    .eq("tournament_key", tournamentKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as KnockoutSettingsRow | null;
}

async function fetchRoundOf32Matches(
  supabase: KnockoutSupabaseClient,
  tournamentKey: string,
) {
  const { data, error } = await supabase
    .from("knockout_matches")
    .select(
      `
      id,
      tournament_key,
      round,
      position,
      external_match_id,
      team_a_source,
      team_a,
      team_a_code,
      team_a_flag_url,
      team_b_source,
      team_b,
      team_b_code,
      team_b_flag_url,
      starts_at,
      winner_team,
      winner_team_code
    `,
    )
    .eq("tournament_key", tournamentKey)
    .eq("round", "round_of_32")
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as KnockoutMatchRow[];
}

function buildDesiredRows(input: {
  tournamentKey: string;
  existingRows: KnockoutMatchRow[];
  groupsByKey: Map<string, GroupSummary>;
}) {
  const rowsByPosition = new Map(
    input.existingRows.map((row) => [row.position, row]),
  );

  return ROUND_OF_32_POSITIONS.map((position) => {
    const existing = rowsByPosition.get(position) ?? null;
    const desiredA = desiredSide(existing, "a", input.groupsByKey);
    const desiredB = desiredSide(existing, "b", input.groupsByKey);

    return {
      existing,
      pendingReasons: [desiredA.pendingReason, desiredB.pendingReason].filter(
        (reason): reason is string => Boolean(reason),
      ),
      row: {
        tournament_key: input.tournamentKey,
        round: "round_of_32" as const,
        position,
        external_match_id: existing?.external_match_id ?? null,
        team_a_source: existing?.team_a_source ?? null,
        team_a: desiredA.team.name,
        team_a_code: desiredA.team.code,
        team_a_flag_url: desiredA.team.flagUrl,
        team_b_source: existing?.team_b_source ?? null,
        team_b: desiredB.team.name,
        team_b_code: desiredB.team.code,
        team_b_flag_url: desiredB.team.flagUrl,
        starts_at: existing?.starts_at ?? null,
        winner_team: existing?.winner_team ?? null,
        winner_team_code: existing?.winner_team_code ?? null,
      },
    };
  });
}

function rowDiff(
  existing: KnockoutMatchRow | null,
  next: KnockoutMatchUpsert,
) {
  if (!existing) {
    return ["create row"];
  }

  return [
    diffSide("team_a", sideSelection(existing, "a"), {
      name: next.team_a,
      code: next.team_a_code,
      flagUrl: next.team_a_flag_url,
    }),
    diffSide("team_b", sideSelection(existing, "b"), {
      name: next.team_b,
      code: next.team_b_code,
      flagUrl: next.team_b_flag_url,
    }),
  ].filter((line): line is string => Boolean(line));
}

async function main() {
  const dryRun = isScoreDryRunEnabled();
  const tournamentKey = parseArg("tournament") ?? KNOCKOUT_TOURNAMENT_KEY;
  const supabaseConfigs = resolveScoreSupabaseEnvs();

  logScoreSupabaseTargets(
    "Knockout fixtures sync multi-target run",
    supabaseConfigs,
    dryRun,
  );
  console.log(`Tournament: ${tournamentKey}`);
  console.log("Round: round_of_32");

  for (const supabaseConfig of supabaseConfigs) {
    await syncTarget({
      dryRun,
      tournamentKey,
      supabaseConfig,
    });
  }
}

async function syncTarget({
  dryRun,
  tournamentKey,
  supabaseConfig,
}: {
  dryRun: boolean;
  tournamentKey: string;
  supabaseConfig: ScoreSupabaseConfig;
}) {
  logScoreSupabaseTarget("Knockout fixtures sync", supabaseConfig, dryRun);

  const supabase = createClient<KnockoutSyncDatabase>(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const settings = await fetchKnockoutSettings(supabase, tournamentKey);

  if (!settings) {
    console.log("No active knockout settings found for this tournament.");
    console.log("No database changes were written.");
    return;
  }

  const [groups, existingRows] = await Promise.all([
    fetchGroups(supabase),
    fetchRoundOf32Matches(supabase, tournamentKey),
  ]);
  const groupsByKey = buildGroupSummaries(groups);
  const desiredRows = buildDesiredRows({
    tournamentKey,
    existingRows,
    groupsByKey,
  });
  const rowsWithDiff = desiredRows
    .map((item) => ({
      ...item,
      diff: rowDiff(item.existing, item.row),
    }))
    .filter((item) => item.diff.length > 0);
  const pendingSlots = desiredRows.filter(
    (item) => item.pendingReasons.length > 0,
  );

  console.log("");
  console.log(`${dryRun ? "[DRY RUN] " : ""}Knockout updates detected:`);
  rowsWithDiff.forEach((item) => {
    console.log("");
    console.log(`round_of_32 position ${item.row.position}`);
    item.diff.forEach((line) => console.log(line));
    item.pendingReasons.forEach((reason) => {
      console.log(`pending: ${reason}`);
    });
  });

  if (pendingSlots.length > 0) {
    console.log("");
    console.log(`Pending slots: ${pendingSlots.length}`);
    pendingSlots.forEach((item) => {
      console.log(
        `round_of_32 position ${item.row.position}: ${item.pendingReasons.join("; ")}`,
      );
    });
  }

  if (!dryRun && rowsWithDiff.length > 0) {
    const { error } = await supabase
      .from("knockout_matches")
      .upsert(
        rowsWithDiff.map((item) => item.row),
        {
          onConflict: "tournament_key,round,position",
        },
      );

    if (error) {
      throw error;
    }
  }

  console.log("");
  console.log(`Knockout sync ${dryRun ? "dry-run " : ""}completed.`);
  console.log(`Target: ${supabaseConfig.target}`);
  console.log(`Tournament: ${tournamentKey}`);
  console.log("Round: round_of_32");
  console.log(`Matches checked: ${ROUND_OF_32_POSITIONS.length}`);
  console.log(
    `Matches to create: ${rowsWithDiff.filter((item) => !item.existing).length}`,
  );
  console.log(
    `Matches to update: ${rowsWithDiff.filter((item) => item.existing).length}`,
  );
  console.log(
    `Matches unchanged: ${ROUND_OF_32_POSITIONS.length - rowsWithDiff.length}`,
  );
  console.log(`Pending slots: ${pendingSlots.length}`);

  if (dryRun) {
    console.log("No database changes were written.");
  } else {
    console.log("Only knockout_matches was updated.");
  }
}

main().catch((error: unknown) => {
  console.error("Knockout fixtures sync failed.");
  console.error(error);
  process.exitCode = 1;
});
