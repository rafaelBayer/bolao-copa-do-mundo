import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateWorldCupData } from "../lib/world-cup/validateWorldCupData";
import type {
  WorldCupGroupSeed,
  WorldCupMatchSeed,
  WorldCupSeedData,
  WorldCupTeamSeed,
} from "../types/worldCupData";

type RawTeamRow = {
  lineNumber: number;
  groupName: string;
  position: number;
  team: WorldCupTeamSeed;
};

type RawMatchRow = {
  lineNumber: number;
  groupName: string;
  match: WorldCupMatchSeed;
};

type CliOptions = {
  dryRun: boolean;
  source: string;
  updatedAt: string;
};

const groupsPath = join("data", "raw", "world-cup-2026-groups.txt");
const matchesPath = join("data", "raw", "world-cup-2026-matches.txt");
const outputPath = join("data", "world-cup-2026.ts");

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    source: "FIFA official match schedule",
    updatedAt: todayIsoDate(),
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length).trim();
      return;
    }

    if (arg.startsWith("--updated-at=")) {
      options.updatedAt = arg.slice("--updated-at=".length).trim();
    }
  });

  return options;
}

function readDataLines(path: string) {
  return readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({
      line: line.trim(),
      lineNumber: index + 1,
    }))
    .filter(({ line }) => line && !line.startsWith("#"));
}

function parseInteger(
  value: string,
  label: string,
  lineNumber: number,
  errors: string[],
) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    errors.push(`Line ${lineNumber}: ${label} must be an integer.`);
    return null;
  }

  return numberValue;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function optionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function parseTeamRows(errors: string[]): RawTeamRow[] {
  return readDataLines(groupsPath).flatMap(({ line, lineNumber }) => {
    const columns = line.split("|").map((column) => column.trim());

    if (columns.length !== 5) {
      errors.push(
        `Line ${lineNumber} in ${groupsPath}: expected 5 columns, found ${columns.length}.`,
      );
      return [];
    }

    const [groupName, rawPosition, teamName, teamCode, flagUrl] = columns;
    const position = parseInteger(rawPosition, "position", lineNumber, errors);

    if (!groupName) {
      errors.push(`Line ${lineNumber} in ${groupsPath}: group is required.`);
    }

    if (!teamName) {
      errors.push(`Line ${lineNumber} in ${groupsPath}: team_name is required.`);
    }

    if (!teamCode) {
      errors.push(`Line ${lineNumber} in ${groupsPath}: team_code is required.`);
    }

    if (position === null) {
      return [];
    }

    return [
      {
        lineNumber,
        groupName,
        position,
        team: {
          name: teamName,
          code: normalizeCode(teamCode),
          flagUrl: optionalValue(flagUrl),
        },
      },
    ];
  });
}

function parseMatchRows(errors: string[]): RawMatchRow[] {
  return readDataLines(matchesPath).flatMap(({ line, lineNumber }) => {
    const columns = line.split("|").map((column) => column.trim());

    if (columns.length !== 9) {
      errors.push(
        `Line ${lineNumber} in ${matchesPath}: expected 9 columns, found ${columns.length}.`,
      );
      return [];
    }

    const [
      groupName,
      rawRoundNumber,
      homeTeamCode,
      awayTeamCode,
      rawFifaMatchNumber,
      kickoffAt,
      stadium,
      city,
      country,
    ] = columns;
    const roundNumber = parseInteger(
      rawRoundNumber,
      "round_number",
      lineNumber,
      errors,
    );
    const fifaMatchNumber =
      rawFifaMatchNumber === ""
        ? undefined
        : parseInteger(
            rawFifaMatchNumber,
            "fifa_match_number",
            lineNumber,
            errors,
          );

    if (!groupName) {
      errors.push(`Line ${lineNumber} in ${matchesPath}: group is required.`);
    }

    if (!homeTeamCode) {
      errors.push(
        `Line ${lineNumber} in ${matchesPath}: home_team_code is required.`,
      );
    }

    if (!awayTeamCode) {
      errors.push(
        `Line ${lineNumber} in ${matchesPath}: away_team_code is required.`,
      );
    }

    if (roundNumber === null || fifaMatchNumber === null) {
      return [];
    }

    return [
      {
        lineNumber,
        groupName,
        match: {
          ...(fifaMatchNumber === undefined ? {} : { fifaMatchNumber }),
          roundNumber,
          homeTeamCode: normalizeCode(homeTeamCode),
          awayTeamCode: normalizeCode(awayTeamCode),
          kickoffAt: optionalValue(kickoffAt),
          stadium: optionalValue(stadium),
          city: optionalValue(city),
          country: optionalValue(country),
        },
      },
    ];
  });
}

function buildData(
  options: CliOptions,
  teamRows: RawTeamRow[],
  matchRows: RawMatchRow[],
  errors: string[],
): WorldCupSeedData {
  const groupOrder: string[] = [];
  const groupsByName = new Map<string, WorldCupGroupSeed>();
  const positionsByGroup = new Map<string, Map<number, number>>();

  teamRows.forEach((row) => {
    if (!groupsByName.has(row.groupName)) {
      groupOrder.push(row.groupName);
      groupsByName.set(row.groupName, {
        name: row.groupName,
        teams: [],
        matches: [],
      });
      positionsByGroup.set(row.groupName, new Map<number, number>());
    }

    const groupPositions = positionsByGroup.get(row.groupName);
    const previousLineNumber = groupPositions?.get(row.position);

    if (previousLineNumber) {
      errors.push(
        `${row.groupName}: position ${row.position} is duplicated on lines ${previousLineNumber} and ${row.lineNumber}.`,
      );
    }

    groupPositions?.set(row.position, row.lineNumber);
    groupsByName.get(row.groupName)?.teams.push(row.team);
  });

  matchRows.forEach((row) => {
    const group = groupsByName.get(row.groupName);

    if (!group) {
      errors.push(
        `Line ${row.lineNumber} in ${matchesPath}: group "${row.groupName}" does not exist in ${groupsPath}.`,
      );
      return;
    }

    group.matches.push(row.match);
  });

  return {
    tournament: "FIFA World Cup 2026",
    source: options.source,
    updatedAt: options.updatedAt,
    groups: groupOrder.map((groupName) => {
      const group = groupsByName.get(groupName);

      if (!group) {
        throw new Error(`Internal error: missing group ${groupName}.`);
      }

      return {
        ...group,
        teams: [...group.teams],
        matches: [...group.matches].sort((left, right) => {
          if (left.roundNumber !== right.roundNumber) {
            return left.roundNumber - right.roundNumber;
          }

          return (left.fifaMatchNumber ?? 0) - (right.fifaMatchNumber ?? 0);
        }),
      };
    }),
  };
}

function formatWorldCupData(data: WorldCupSeedData) {
  return `import type { WorldCupSeedData } from "../types/worldCupData";

export const worldCup2026Data: WorldCupSeedData = ${JSON.stringify(
    data,
    null,
    2,
  )};
`;
}

function printErrors(title: string, errors: string[]) {
  console.error(title);
  errors.forEach((error) => {
    console.error(`- ${error}`);
  });
}

function main() {
  const options = parseArgs();
  const parseErrors: string[] = [];

  console.log("Reading raw World Cup 2026 data...");
  const teamRows = parseTeamRows(parseErrors);
  const matchRows = parseMatchRows(parseErrors);
  const data = buildData(options, teamRows, matchRows, parseErrors);

  if (parseErrors.length > 0) {
    printErrors("Raw World Cup 2026 data is invalid.", parseErrors);
    process.exit(1);
  }

  console.log("Validating generated data...");
  const validation = validateWorldCupData(data);

  if (!validation.valid) {
    printErrors("Generated World Cup 2026 data is invalid.", validation.errors);
    process.exit(1);
  }

  console.log("Generated World Cup 2026 data is valid.");
  console.log(`Groups: ${validation.summary.groups}`);
  console.log(`Teams: ${validation.summary.teams}`);
  console.log(`Group matches: ${validation.summary.matches}`);

  if (options.dryRun) {
    console.log("Dry run enabled. No file was written.");
    return;
  }

  writeFileSync(outputPath, formatWorldCupData(data), "utf8");
  console.log(`Wrote ${outputPath}.`);
}

main();
