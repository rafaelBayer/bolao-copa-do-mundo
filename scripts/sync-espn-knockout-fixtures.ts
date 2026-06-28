import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchEspnScoreboardByDate,
  mapEspnEventToInternalMatch,
  normalizeEspnTeamName,
  type EspnEvent,
} from "../lib/scores/providers/espn";
import { KNOCKOUT_TOURNAMENT_KEY } from "../lib/knockout/bracketStructure";
import {
  isScoreDryRunEnabled,
  logScoreSupabaseTarget,
  logScoreSupabaseTargets,
  resolveScoreSupabaseEnvs,
  type ScoreSupabaseConfig,
} from "../lib/scores/resolveScoreSupabaseEnv";

type KnockoutRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "third_place";

type Database = {
  public: {
    Tables: {
      teams: {
        Row: TeamRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      matches: {
        Row: GroupMatchRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knockout_settings: {
        Row: KnockoutSettingsRow;
        Insert: KnockoutSettingsUpsert;
        Update: Partial<KnockoutSettingsUpsert>;
        Relationships: [];
      };
      knockout_matches: {
        Row: KnockoutMatchRow;
        Insert: KnockoutMatchUpsert;
        Update: Partial<KnockoutMatchUpsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
  flag_url: string | null;
};

type GroupMatchRow = {
  score_provider_fixture_id: string | null;
};

type KnockoutSettingsRow = {
  id: string;
  tournament_key: string;
  name: string;
  deadline_at: string;
  is_active: boolean;
};

type KnockoutSettingsUpsert = {
  tournament_key: string;
  name: string;
  deadline_at: string;
  is_active: boolean;
};

type KnockoutMatchRow = {
  id: string;
  tournament_key: string;
  round: KnockoutRound;
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
type DbClient = SupabaseClient<Database>;

type KnockoutFixture = {
  externalMatchId: string;
  startsAt: string;
  homeName: string;
  homeCode: string | null;
  awayName: string;
  awayCode: string | null;
};

type SourceRef = {
  round: KnockoutRound;
  position: number;
  outcome: "Winner" | "Loser";
};

type OfficialFixture = {
  round: KnockoutRound;
  officialPosition: number;
  fixture: KnockoutFixture;
  homeSource: SourceRef | null;
  awaySource: SourceRef | null;
};

type ThirdPlaceFixture = {
  fixture: KnockoutFixture;
  homeSource: SourceRef;
  awaySource: SourceRef;
};

type TeamSelection = {
  name: string;
  code: string | null;
  flagUrl: string | null;
};

const DEFAULT_FROM = "2026-06-28";
const DEFAULT_TO = "2026-07-19";
const TOURNAMENT_NAME = "Copa do Mundo 2026";
const EXPECTED_COUNTS: Record<KnockoutRound, number> = {
  round_of_32: 16,
  round_of_16: 8,
  quarterfinal: 4,
  semifinal: 2,
  final: 1,
  third_place: 1,
};
const EXPECTED_TOTAL_ROWS = Object.values(EXPECTED_COUNTS).reduce(
  (total, count) => total + count,
  0,
);
const ROUND_LABELS: Record<KnockoutRound, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
  third_place: "Third Place",
};
const NEXT_ROUND: Partial<Record<KnockoutRound, KnockoutRound>> = {
  round_of_32: "round_of_16",
  round_of_16: "quarterfinal",
  quarterfinal: "semifinal",
  semifinal: "final",
};
const ROUND_OF_32_SOURCE_BY_CODE_PAIR = new Map([
  ["RSA-CAN", 1], // J73
  ["GER-PAR", 2], // J74
  ["NED-MAR", 3], // J75
  ["BRA-JPN", 4], // J76
  ["FRA-SWE", 5], // J77
  ["CIV-NOR", 6], // J78
  ["MEX-ECU", 7], // J79
  ["ENG-COD", 8], // J80
  ["USA-BIH", 9], // J81
  ["BEL-SEN", 10], // J82
  ["POR-CRO", 11], // J83
  ["ESP-AUT", 12], // J84
  ["SUI-ALG", 13], // J85
  ["ARG-CPV", 14], // J86
  ["COL-GHA", 15], // J87
  ["AUS-EGY", 16], // J88
]);
const FIFA_MATCH_NUMBER_BY_OFFICIAL: Record<KnockoutRound, Map<number, number>> = {
  round_of_32: new Map([
    [1, 73],
    [2, 74],
    [3, 75],
    [4, 76],
    [5, 77],
    [6, 78],
    [7, 79],
    [8, 80],
    [9, 81],
    [10, 82],
    [11, 83],
    [12, 84],
    [13, 85],
    [14, 86],
    [15, 87],
    [16, 88],
  ]),
  round_of_16: new Map([
    [1, 90],
    [2, 89],
    [3, 91],
    [4, 92],
    [5, 93],
    [6, 94],
    [7, 96],
    [8, 95],
  ]),
  quarterfinal: new Map([
    [1, 97],
    [2, 98],
    [3, 99],
    [4, 100],
  ]),
  semifinal: new Map([
    [1, 101],
    [2, 102],
  ]),
  final: new Map([[1, 104]]),
  third_place: new Map([[1, 103]]),
};
const INTERNAL_POSITION_BY_OFFICIAL: Record<KnockoutRound, Map<number, number>> = {
  round_of_32: new Map([
    [1, 3],
    [2, 1],
    [3, 4],
    [4, 9],
    [5, 2],
    [6, 10],
    [7, 11],
    [8, 12],
    [9, 7],
    [10, 8],
    [11, 5],
    [12, 6],
    [13, 15],
    [14, 13],
    [15, 16],
    [16, 14],
  ]),
  round_of_16: new Map([
    [1, 2], // J90
    [2, 1], // J89
    [3, 5], // J91
    [4, 6], // J92
    [5, 3], // J93
    [6, 4], // J94
    [7, 8], // J96
    [8, 7], // J95
  ]),
  quarterfinal: new Map([
    [1, 1], // J97
    [2, 2], // J98
    [3, 3], // J99
    [4, 4], // J100
  ]),
  semifinal: new Map([
    [1, 1], // J101
    [2, 2], // J102
  ]),
  final: new Map([[1, 1]]), // J104
  third_place: new Map([[1, 1]]), // J103
};

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg?.slice(prefix.length).trim() || null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function espnDatePart(date: Date) {
  return isoDate(date).replace(/-/g, "");
}

function dateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dayMs = 24 * 60 * 60 * 1000;
  const dates: string[] = [];

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error("Invalid --from or --to date. Use YYYY-MM-DD.");
  }

  if (start > end) {
    throw new Error("--from must be before --to.");
  }

  for (let time = start.getTime(); time <= end.getTime(); time += dayMs) {
    dates.push(espnDatePart(new Date(time)));
  }

  return dates;
}

function numericExternalId(fixture: KnockoutFixture) {
  const parsed = Number.parseInt(fixture.externalMatchId, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`ESPN fixture id is not numeric: ${fixture.externalMatchId}`);
  }

  return parsed;
}

function sourceRefFromTeamName(value: string): SourceRef | null {
  const match = value.match(
    /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) (Winner|Loser)$/i,
  );

  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const roundLabel = match[1].toLowerCase();
  const round =
    roundLabel === "round of 32"
      ? "round_of_32"
      : roundLabel === "round of 16"
        ? "round_of_16"
        : roundLabel === "quarterfinal"
          ? "quarterfinal"
          : "semifinal";

  return {
    round,
    position: Number.parseInt(match[2], 10),
    outcome: match[3] as "Winner" | "Loser",
  };
}

function isConcreteTeamName(value: string) {
  return !sourceRefFromTeamName(value) &&
    !/^(tbd|a definir|to be determined)$/i.test(value.trim());
}

function fixtureFromEvent(event: EspnEvent): KnockoutFixture | null {
  const fixture = mapEspnEventToInternalMatch(event);

  if (!fixture?.utcDate || !fixture.homeTeamName || !fixture.awayTeamName) {
    return null;
  }

  return {
    externalMatchId: String(fixture.providerFixtureId),
    startsAt: fixture.utcDate,
    homeName: fixture.homeTeamName,
    homeCode: fixture.homeTeamCode ?? null,
    awayName: fixture.awayTeamName,
    awayCode: fixture.awayTeamCode ?? null,
  };
}

function uniqueFixtures(events: EspnEvent[]) {
  const byId = new Map<string, KnockoutFixture>();

  events.forEach((event) => {
    const fixture = fixtureFromEvent(event);

    if (fixture) {
      byId.set(fixture.externalMatchId, fixture);
    }
  });

  return Array.from(byId.values()).sort(
    (left, right) => numericExternalId(left) - numericExternalId(right),
  );
}

function roundOf32SourcePosition(fixture: KnockoutFixture) {
  const pairKey = `${normalizeCode(fixture.homeCode)}-${normalizeCode(fixture.awayCode)}`;
  const sourcePosition = ROUND_OF_32_SOURCE_BY_CODE_PAIR.get(pairKey);

  if (!sourcePosition) {
    throw new Error(
      `Could not map round_of_32 fixture to a FIFA source position: ${pairKey} (${fixture.homeName} x ${fixture.awayName}).`,
    );
  }

  return sourcePosition;
}

function officialPositionedFixtures(
  round: KnockoutRound,
  fixtures: KnockoutFixture[],
): OfficialFixture[] {
  return fixtures.map((fixture) => ({
      round,
      officialPosition: roundOf32SourcePosition(fixture),
      fixture,
      homeSource: sourceRefFromTeamName(fixture.homeName),
      awaySource: sourceRefFromTeamName(fixture.awayName),
    }))
    .sort((left, right) => left.officialPosition - right.officialPosition);
}

function classifyOfficialFixtures(fixtures: KnockoutFixture[]) {
  const concrete = fixtures.filter(
    (fixture) =>
      isConcreteTeamName(fixture.homeName) &&
      isConcreteTeamName(fixture.awayName),
  );
  const sourceFixtures = fixtures
    .map((fixture) => ({
      fixture,
      homeSource: sourceRefFromTeamName(fixture.homeName),
      awaySource: sourceRefFromTeamName(fixture.awayName),
    }))
    .filter((item) => item.homeSource && item.awaySource);
  const byRound: Record<KnockoutRound, OfficialFixture[]> = {
    round_of_32: officialPositionedFixtures("round_of_32", concrete),
    round_of_16: [],
    quarterfinal: [],
    semifinal: [],
    final: [],
    third_place: [],
  };
  let thirdPlaceFixture: ThirdPlaceFixture | null = null;

  for (const item of sourceFixtures) {
    const homeSource = item.homeSource as SourceRef;
    const awaySource = item.awaySource as SourceRef;

    if (
      homeSource.round !== awaySource.round ||
      homeSource.outcome !== awaySource.outcome
    ) {
      throw new Error(
        `Inconsistent ESPN source fixture: ${item.fixture.homeName} x ${item.fixture.awayName}`,
      );
    }

    if (homeSource.outcome === "Loser") {
      if (
        homeSource.round === "semifinal" &&
        awaySource.round === "semifinal" &&
        homeSource.position === 1 &&
        awaySource.position === 2
      ) {
        thirdPlaceFixture = {
          fixture: item.fixture,
          homeSource,
          awaySource,
        };
        byRound.third_place.push({
          round: "third_place",
          officialPosition: 1,
          fixture: item.fixture,
          homeSource,
          awaySource,
        });
      }
      continue;
    }

    const targetRound = NEXT_ROUND[homeSource.round];

    if (!targetRound) {
      continue;
    }

    byRound[targetRound].push({
      round: targetRound,
      officialPosition: 0,
      fixture: item.fixture,
      homeSource,
      awaySource,
    });
  }

  (Object.keys(byRound) as KnockoutRound[]).forEach((round) => {
    if (round === "round_of_32") {
      byRound[round] = byRound[round].sort(
        (left, right) => left.officialPosition - right.officialPosition,
      );
      return;
    }

    byRound[round] = byRound[round]
      .sort((left, right) => numericExternalId(left.fixture) - numericExternalId(right.fixture))
      .map((item, index) => ({
        ...item,
        officialPosition: index + 1,
      }));
  });

  return {
    byRound,
    thirdPlaceFixture,
  };
}

function validateOfficialFixtures(input: {
  byRound: Record<KnockoutRound, OfficialFixture[]>;
  thirdPlaceFixture: ThirdPlaceFixture | null;
}) {
  const { byRound, thirdPlaceFixture } = input;

  (Object.keys(EXPECTED_COUNTS) as KnockoutRound[]).forEach((round) => {
    const expected = EXPECTED_COUNTS[round];
    const actual = byRound[round].length;

    if (actual !== expected) {
      throw new Error(
        `Expected ${expected} ${round} fixtures from ESPN, found ${actual}. Aborting without writing.`,
      );
    }
  });

  const roundOf32Ids = byRound.round_of_32
    .map((item) => numericExternalId(item.fixture))
    .sort((left, right) => left - right);
  const minId = Math.min(...roundOf32Ids);
  const expectedIds = Array.from({ length: 16 }, (_, index) => minId + index);

  if (roundOf32Ids.some((id, index) => id !== expectedIds[index])) {
    throw new Error(
      `Round of 32 ESPN ids are not contiguous: ${roundOf32Ids.join(", ")}.`,
    );
  }

  if (!thirdPlaceFixture) {
    throw new Error(
      "Expected FIFA third-place fixture J103 from semifinal losers, but it was not found. Aborting without writing.",
    );
  }

  console.log(
    `Third-place fixture validated: ${thirdPlaceFixture.fixture.homeName} x ${thirdPlaceFixture.fixture.awayName}`,
  );
}

function validateInternalPositions(byRound: Record<KnockoutRound, OfficialFixture[]>) {
  (Object.keys(EXPECTED_COUNTS) as KnockoutRound[]).forEach((round) => {
    const expected = EXPECTED_COUNTS[round];
    const actual = INTERNAL_POSITION_BY_OFFICIAL[round].size;

    if (actual !== expected) {
      throw new Error(
        `Could not derive full internal bracket mapping for ${round}: ${actual}/${expected}.`,
      );
    }

    const positions = Array.from(INTERNAL_POSITION_BY_OFFICIAL[round].values()).sort(
      (left, right) => left - right,
    );

    for (let index = 0; index < expected; index += 1) {
      if (positions[index] !== index + 1) {
        throw new Error(
          `Invalid internal positions for ${round}: ${positions.join(", ")}.`,
        );
      }
    }
  });

  (Object.keys(byRound) as KnockoutRound[]).forEach((round) => {
    if (round === "round_of_32") {
      return;
    }

    byRound[round].forEach((fixture) => {
      if (!fixture.homeSource || !fixture.awaySource) {
        throw new Error(
          `${round} official position ${fixture.officialPosition} is missing source placeholders.`,
        );
      }

      const internalPosition = INTERNAL_POSITION_BY_OFFICIAL[round].get(
        fixture.officialPosition,
      );
      const homeInternal = INTERNAL_POSITION_BY_OFFICIAL[
        fixture.homeSource.round
      ].get(fixture.homeSource.position);
      const awayInternal = INTERNAL_POSITION_BY_OFFICIAL[
        fixture.awaySource.round
      ].get(fixture.awaySource.position);

      if (!internalPosition || !homeInternal || !awayInternal) {
        throw new Error(
          `Missing FIFA internal mapping for ${round} official ${fixture.officialPosition}.`,
        );
      }

      const expectedPair = [internalPosition * 2 - 1, internalPosition * 2];
      const actualPair = [homeInternal, awayInternal].sort((left, right) => left - right);

      if (
        actualPair[0] !== expectedPair[0] ||
        actualPair[1] !== expectedPair[1]
      ) {
        throw new Error(
          `FIFA topology mismatch for ${round} official ${fixture.officialPosition}: sources mapped to ${actualPair.join("/")} but expected ${expectedPair.join("/")}.`,
        );
      }
    });
  });

  return INTERNAL_POSITION_BY_OFFICIAL;
}

function lockAtForFirstMatch(firstMatchStartsAt: string) {
  return new Date(new Date(firstMatchStartsAt).getTime() - 10 * 60 * 1000)
    .toISOString();
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function resolveTeam(
  teams: TeamRow[],
  name: string,
  code: string | null,
): TeamSelection {
  if (!isConcreteTeamName(name)) {
    return {
      name,
      code: normalizeCode(code),
      flagUrl: null,
    };
  }

  const normalizedCode = normalizeCode(code);
  const byCode = normalizedCode
    ? teams.find((team) => normalizeCode(team.code) === normalizedCode)
    : null;
  const byName = teams.find(
    (team) => normalizeEspnTeamName(team.name) === normalizeEspnTeamName(name),
  );
  const team = byCode ?? byName ?? null;

  return {
    name: team?.name ?? name,
    code: team?.code ?? normalizedCode,
    flagUrl: team?.flag_url ?? null,
  };
}

async function fetchTeams(supabase: DbClient) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, code, flag_url");

  if (error) {
    throw error;
  }

  return (data ?? []) as TeamRow[];
}

async function fetchGroupStageFixtureIds(supabase: DbClient) {
  const { data, error } = await supabase
    .from("matches")
    .select("score_provider_fixture_id")
    .not("score_provider_fixture_id", "is", null);

  if (error) {
    throw error;
  }

  return new Set(
    ((data ?? []) as GroupMatchRow[])
      .map((match) => match.score_provider_fixture_id)
      .filter((value): value is string => Boolean(value)),
  );
}

async function fetchExistingSettings(
  supabase: DbClient,
  tournamentKey: string,
) {
  const { data, error } = await supabase
    .from("knockout_settings")
    .select("id, tournament_key, name, deadline_at, is_active")
    .eq("tournament_key", tournamentKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as KnockoutSettingsRow | null;
}

async function fetchExistingMatches(supabase: DbClient, tournamentKey: string) {
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
    .eq("tournament_key", tournamentKey);

  if (error) {
    throw error;
  }

  return (data ?? []) as KnockoutMatchRow[];
}

function sameInstant(left: string | null, right: string | null) {
  if (!left || !right) {
    return left === right;
  }

  return new Date(left).getTime() === new Date(right).getTime();
}

function rowKey(round: KnockoutRound, position: number) {
  return `${round}:${position}`;
}

function sourceLabel(source: SourceRef | null) {
  if (!source) {
    return null;
  }

  const fifaMatchNumber = FIFA_MATCH_NUMBER_BY_OFFICIAL[source.round].get(
    source.position,
  );

  if (source.outcome === "Winner" && fifaMatchNumber) {
    return `W${fifaMatchNumber}`;
  }

  if (source.outcome === "Loser" && fifaMatchNumber) {
    return `L${fifaMatchNumber}`;
  }

  return `${ROUND_LABELS[source.round]} ${source.position} ${source.outcome}`;
}

function buildRows(input: {
  byRound: Record<KnockoutRound, OfficialFixture[]>;
  internalByOfficial: Record<KnockoutRound, Map<number, number>>;
  teams: TeamRow[];
  existingMatches: KnockoutMatchRow[];
  tournamentKey: string;
}) {
  const existingByKey = new Map(
    input.existingMatches.map((match) => [
      rowKey(match.round, match.position),
      match,
    ]),
  );
  const rows: Array<{
    existing: KnockoutMatchRow | null;
    row: KnockoutMatchUpsert;
    officialPosition: number;
  }> = [];
  const orderedSources = (official: OfficialFixture) => {
    if (!official.homeSource || !official.awaySource) {
      return [official.homeSource, official.awaySource] as const;
    }

    const homeInternal = input.internalByOfficial[
      official.homeSource.round
    ].get(official.homeSource.position);
    const awayInternal = input.internalByOfficial[
      official.awaySource.round
    ].get(official.awaySource.position);

    if (homeInternal && awayInternal && homeInternal > awayInternal) {
      return [official.awaySource, official.homeSource] as const;
    }

    return [official.homeSource, official.awaySource] as const;
  };

  (Object.keys(input.byRound) as KnockoutRound[]).forEach((round) => {
    input.byRound[round].forEach((official) => {
      const internalPosition = input.internalByOfficial[round].get(
        official.officialPosition,
      );

      if (!internalPosition) {
        throw new Error(
          `Missing internal position for ${round} official ${official.officialPosition}.`,
        );
      }

      const existing = existingByKey.get(rowKey(round, internalPosition));
      const [orderedHomeSource, orderedAwaySource] = orderedSources(official);
      const homeLabel = sourceLabel(orderedHomeSource);
      const awayLabel = sourceLabel(orderedAwaySource);
      const home = resolveTeam(
        input.teams,
        homeLabel ?? official.fixture.homeName,
        official.fixture.homeCode,
      );
      const away = resolveTeam(
        input.teams,
        awayLabel ?? official.fixture.awayName,
        official.fixture.awayCode,
      );

      rows.push({
        existing: existing ?? null,
        officialPosition: official.officialPosition,
        row: {
          tournament_key: input.tournamentKey,
          round,
          position: internalPosition,
          external_match_id: official.fixture.externalMatchId,
          team_a_source: homeLabel,
          team_a: home.name,
          team_a_code: home.code,
          team_a_flag_url: home.flagUrl,
          team_b_source: awayLabel,
          team_b: away.name,
          team_b_code: away.code,
          team_b_flag_url: away.flagUrl,
          starts_at: official.fixture.startsAt,
          winner_team: existing?.winner_team ?? null,
          winner_team_code: existing?.winner_team_code ?? null,
        },
      });
    });
  });

  return rows.sort((left, right) => {
    const roundOrder =
      Object.keys(EXPECTED_COUNTS).indexOf(left.row.round) -
      Object.keys(EXPECTED_COUNTS).indexOf(right.row.round);

    if (roundOrder !== 0) {
      return roundOrder;
    }

    return left.row.position - right.row.position;
  });
}

function changedFields(
  existing: KnockoutMatchRow | null,
  row: KnockoutMatchUpsert,
) {
  if (!existing) {
    return [
      "create row",
      `team_a: ${row.team_a ?? "null"}`,
      `team_b: ${row.team_b ?? "null"}`,
      `starts_at: ${row.starts_at ?? "null"}`,
    ];
  }

  const changes: string[] = [];
  const fields = [
    "external_match_id",
    "team_a_source",
    "team_a",
    "team_a_code",
    "team_a_flag_url",
    "team_b_source",
    "team_b",
    "team_b_code",
    "team_b_flag_url",
    "winner_team",
    "winner_team_code",
  ] as const;

  fields.forEach((field) => {
    if (existing[field] !== row[field]) {
      changes.push(`${field}: ${existing[field] ?? "null"} -> ${row[field] ?? "null"}`);
    }
  });

  if (!sameInstant(existing.starts_at, row.starts_at)) {
    changes.push(`starts_at: ${existing.starts_at ?? "null"} -> ${row.starts_at ?? "null"}`);
  }

  return changes;
}

async function fetchEspnFixtures(input: { from: string; to: string }) {
  const dates = dateRange(input.from, input.to);
  const eventsById = new Map<string, EspnEvent>();

  console.log(`Fetching ESPN scoreboards for ${dates.length} dates...`);
  console.log(`Date range: ${dates.join(", ")}`);

  for (const date of dates) {
    const events = await fetchEspnScoreboardByDate(date);

    events.forEach((event) => {
      if (typeof event.id === "string" || typeof event.id === "number") {
        eventsById.set(String(event.id), event);
      }
    });
  }

  return uniqueFixtures(Array.from(eventsById.values()));
}

function summarizeMapping(
  byRound: Record<KnockoutRound, OfficialFixture[]>,
  internalByOfficial: Record<KnockoutRound, Map<number, number>>,
) {
  console.log("");
  console.log("Official ESPN bracket mapping:");

  (Object.keys(EXPECTED_COUNTS) as KnockoutRound[]).forEach((round) => {
    byRound[round].forEach((fixture) => {
      const internalPosition = internalByOfficial[round].get(
        fixture.officialPosition,
      );
      console.log(
        `${round} official ${fixture.officialPosition} -> internal ${internalPosition}: ${fixture.fixture.homeName} x ${fixture.fixture.awayName}`,
      );
    });
  });
}

async function syncTarget(input: {
  dryRun: boolean;
  tournamentKey: string;
  from: string;
  supabaseConfig: ScoreSupabaseConfig;
  allFixtures: KnockoutFixture[];
}) {
  logScoreSupabaseTarget(
    "ESPN knockout fixtures sync",
    input.supabaseConfig,
    input.dryRun,
  );

  const supabase = createClient<Database>(
    input.supabaseConfig.supabaseUrl,
    input.supabaseConfig.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const [teams, groupFixtureIds, settings, existingMatches] = await Promise.all([
    fetchTeams(supabase),
    fetchGroupStageFixtureIds(supabase),
    fetchExistingSettings(supabase, input.tournamentKey),
    fetchExistingMatches(supabase, input.tournamentKey),
  ]);
  const bracketFixtures = input.allFixtures.filter(
    (fixture) => !groupFixtureIds.has(fixture.externalMatchId),
  );
  const { byRound, thirdPlaceFixture } = classifyOfficialFixtures(bracketFixtures);

  validateOfficialFixtures({ byRound, thirdPlaceFixture });

  const internalByOfficial = validateInternalPositions(byRound);
  const firstMatchStartsAt = byRound.round_of_32
    .map((item) => item.fixture.startsAt)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
  const deadlineAt = lockAtForFirstMatch(firstMatchStartsAt);
  const settingsRow: KnockoutSettingsUpsert = {
    tournament_key: input.tournamentKey,
    name: settings?.name ?? TOURNAMENT_NAME,
    deadline_at: deadlineAt,
    is_active: true,
  };
  const rows = buildRows({
    byRound,
    internalByOfficial,
    teams,
    existingMatches,
    tournamentKey: input.tournamentKey,
  });
  const rowsWithDiff = rows
    .map((item) => ({
      ...item,
      diff: changedFields(item.existing, item.row),
    }))
    .filter((item) => item.diff.length > 0);
  const settingsNeedsUpsert =
    !settings ||
    settings.name !== settingsRow.name ||
    settings.is_active !== true ||
    !sameInstant(settings.deadline_at, settingsRow.deadline_at);

  console.log("");
  console.log(`ESPN fixtures loaded: ${input.allFixtures.length}`);
  console.log(`Group-stage fixtures filtered out: ${input.allFixtures.length - bracketFixtures.length}`);
  console.log(`Bracket fixtures accepted: ${bracketFixtures.length}`);
  console.log(`Rows prepared: ${rows.length}/${EXPECTED_TOTAL_ROWS}`);
  console.log(`First knockout match: ${firstMatchStartsAt}`);
  console.log(`Deadline: ${deadlineAt}`);
  console.log(`Settings ${settingsNeedsUpsert ? input.dryRun ? "would be upserted" : "will be upserted" : "already up to date"}.`);
  summarizeMapping(byRound, internalByOfficial);

  rowsWithDiff.forEach((item) => {
    console.log("");
    console.log(
      `${item.row.round} internal ${item.row.position} (official ${item.officialPosition})`,
    );
    item.diff.forEach((line) => console.log(line));
  });

  if (!input.dryRun && settingsNeedsUpsert) {
    const { error } = await supabase
      .from("knockout_settings")
      .upsert(settingsRow, { onConflict: "tournament_key" });

    if (error) {
      throw error;
    }
  }

  if (!input.dryRun && rowsWithDiff.length > 0) {
    const { error } = await supabase
      .from("knockout_matches")
      .upsert(
        rowsWithDiff.map((item) => item.row),
        { onConflict: "tournament_key,round,position" },
      );

    if (error) {
      throw error;
    }
  }

  console.log("");
  console.log(`ESPN knockout sync ${input.dryRun ? "dry-run " : ""}completed.`);
  console.log(`Target: ${input.supabaseConfig.target}`);
  console.log(`Tournament: ${input.tournamentKey}`);
  console.log(`Matches to create: ${rowsWithDiff.filter((item) => !item.existing).length}`);
  console.log(`Matches to update: ${rowsWithDiff.filter((item) => item.existing).length}`);
  console.log(`Matches unchanged: ${rows.length - rowsWithDiff.length}`);

  if (input.dryRun) {
    console.log("No database changes were written.");
  }
}

async function main() {
  const dryRun = isScoreDryRunEnabled();
  const tournamentKey = parseArg("tournament") ?? KNOCKOUT_TOURNAMENT_KEY;
  const from = parseArg("from") ?? DEFAULT_FROM;
  const to = parseArg("to") ?? DEFAULT_TO;
  const supabaseConfigs = resolveScoreSupabaseEnvs();

  logScoreSupabaseTargets(
    "ESPN knockout fixtures sync multi-target run",
    supabaseConfigs,
    dryRun,
  );
  console.log(`Tournament: ${tournamentKey}`);
  console.log(`Range: ${from} to ${to}`);

  const allFixtures = await fetchEspnFixtures({ from, to });

  for (const supabaseConfig of supabaseConfigs) {
    await syncTarget({
      dryRun,
      tournamentKey,
      from,
      supabaseConfig,
      allFixtures,
    });
  }
}

main().catch((error: unknown) => {
  console.error("ESPN knockout fixtures sync failed.");
  console.error(error);
  process.exitCode = 1;
});
