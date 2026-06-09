import { teamCodeMap } from "./teamCodeMap";
import { teamNamePtBrMap } from "./teamNamePtBrMap";
import type {
  WorldCupGroupSeed,
  WorldCupMatchSeed,
  WorldCupSeedData,
  WorldCupTeamSeed,
} from "../../types/worldCupData";

type OpenFootballMatch = {
  round?: unknown;
  num?: unknown;
  date?: unknown;
  time?: unknown;
  team1?: unknown;
  team2?: unknown;
  group?: unknown;
  ground?: unknown;
  stadium?: unknown;
  city?: unknown;
  country?: unknown;
};

type OpenFootballData = {
  name?: unknown;
  matches?: unknown;
};

type IndexedMatch = {
  sourceIndex: number;
  match: OpenFootballMatch;
};

type AdapterInput = {
  rawData: unknown;
  updatedAt: string;
};

function assertOpenFootballData(rawData: unknown): OpenFootballData {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("OpenFootball payload must be an object.");
  }

  const data = rawData as OpenFootballData;

  if (!Array.isArray(data.matches)) {
    throw new Error("OpenFootball payload must include a matches array.");
  }

  return data;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const stringValue = asString(value);

  return stringValue || null;
}

function groupNamePtBr(groupName: string) {
  const match = /^Group\s+([A-L])$/i.exec(groupName);

  if (!match) {
    throw new Error(`Unsupported OpenFootball group name: ${groupName}`);
  }

  return `Grupo ${match[1].toUpperCase()}`;
}

function getTeamCode(teamName: string) {
  return teamCodeMap[teamName];
}

function getTeamName(teamName: string) {
  return teamNamePtBrMap[teamName] ?? teamName;
}

function parseMatchNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  // OpenFootball sometimes omits the official match number. In that case, use
  // the source order so the generated file stays deterministic and idempotent.
  return fallback;
}

function parseKickoffAt(dateValue: unknown, timeValue: unknown) {
  const date = asString(dateValue);
  const time = asString(timeValue);

  if (!date || !time) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})(?::?(\d{2}))?$/.exec(
    time,
  );

  if (!match) {
    return null;
  }

  const [, rawHour, rawMinute, rawOffsetHour, rawOffsetMinute] = match;
  const hour = rawHour.padStart(2, "0");
  const minute = rawMinute.padStart(2, "0");
  const offsetSign = rawOffsetHour.startsWith("-") ? "-" : "+";
  const offsetHour = rawOffsetHour.replace(/[+-]/, "").padStart(2, "0");
  const offsetMinute = (rawOffsetMinute ?? "00").padStart(2, "0");
  const isoLike = `${date}T${hour}:${minute}:00${offsetSign}${offsetHour}:${offsetMinute}`;
  const parsedDate = new Date(isoLike);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function isGroupStageMatch(match: OpenFootballMatch) {
  return Boolean(asString(match.group));
}

function sourceTimestamp(match: OpenFootballMatch) {
  const date = asString(match.date);
  const time = asString(match.time);
  const timestamp = Date.parse(`${date}T${time.split(" ")[0] ?? ""}:00Z`);

  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function compareSourceOrder(left: IndexedMatch, right: IndexedMatch) {
  const leftTimestamp = sourceTimestamp(left.match);
  const rightTimestamp = sourceTimestamp(right.match);

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return left.sourceIndex - right.sourceIndex;
}

function collectGroupMatches(matches: IndexedMatch[]) {
  const groupOrder: string[] = [];
  const matchesByGroup = new Map<string, IndexedMatch[]>();

  matches.forEach((indexedMatch) => {
    const group = asString(indexedMatch.match.group);

    if (!matchesByGroup.has(group)) {
      groupOrder.push(group);
      matchesByGroup.set(group, []);
    }

    matchesByGroup.get(group)?.push(indexedMatch);
  });

  return {
    groupOrder,
    matchesByGroup,
  };
}

function uniqueTeamsForGroup(matches: IndexedMatch[], errors: string[]) {
  const teams = new Map<string, WorldCupTeamSeed>();

  matches.forEach(({ match }) => {
    [asString(match.team1), asString(match.team2)].forEach((teamName) => {
      if (!teamName || teams.has(teamName)) {
        return;
      }

      const code = getTeamCode(teamName);

      if (!code) {
        errors.push(`Missing team code for: ${teamName}`);
        return;
      }

      teams.set(teamName, {
        name: getTeamName(teamName),
        code,
        flagUrl: null,
      });
    });
  });

  return Array.from(teams.values());
}

function toWorldCupMatch(
  indexedMatch: IndexedMatch,
  roundNumber: number,
): WorldCupMatchSeed | null {
  const { match, sourceIndex } = indexedMatch;
  const team1 = asString(match.team1);
  const team2 = asString(match.team2);
  const homeTeamCode = getTeamCode(team1);
  const awayTeamCode = getTeamCode(team2);

  if (!homeTeamCode || !awayTeamCode) {
    return null;
  }

  return {
    fifaMatchNumber: parseMatchNumber(match.num, sourceIndex + 1),
    roundNumber,
    homeTeamCode,
    awayTeamCode,
    kickoffAt: parseKickoffAt(match.date, match.time),
    stadium: asOptionalString(match.stadium),
    city: asOptionalString(match.city) ?? asOptionalString(match.ground),
    country: asOptionalString(match.country),
  };
}

function buildGroup(
  openFootballGroupName: string,
  indexedMatches: IndexedMatch[],
  errors: string[],
) {
  const sortedMatches = [...indexedMatches].sort(compareSourceOrder);
  const teams = uniqueTeamsForGroup(sortedMatches, errors);
  const matches = sortedMatches
    .map((indexedMatch, index) =>
      // OpenFootball's "Matchday" is tournament-wide, not the group round.
      // A group has two matches per round, so derive rounds from group order.
      toWorldCupMatch(indexedMatch, Math.floor(index / 2) + 1),
    )
    .filter((match): match is WorldCupMatchSeed => Boolean(match));

  return {
    name: groupNamePtBr(openFootballGroupName),
    teams,
    matches,
  };
}

export function openFootballToWorldCupSeedData({
  rawData,
  updatedAt,
}: AdapterInput): WorldCupSeedData {
  const data = assertOpenFootballData(rawData);
  const errors: string[] = [];
  const groupStageMatches = (data.matches as OpenFootballMatch[])
    .map((match, sourceIndex) => ({ match, sourceIndex }))
    .filter(({ match }) => isGroupStageMatch(match));

  groupStageMatches.forEach(({ match, sourceIndex }) => {
    if (!asString(match.team1)) {
      errors.push(`OpenFootball match ${sourceIndex + 1} is missing team1.`);
    }

    if (!asString(match.team2)) {
      errors.push(`OpenFootball match ${sourceIndex + 1} is missing team2.`);
    }

    if (!asString(match.group)) {
      errors.push(`OpenFootball match ${sourceIndex + 1} is missing group.`);
    }
  });

  const { groupOrder, matchesByGroup } = collectGroupMatches(groupStageMatches);
  const groups: WorldCupGroupSeed[] = groupOrder.map((groupName) => {
    const matches = matchesByGroup.get(groupName) ?? [];

    return buildGroup(groupName, matches, errors);
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    tournament: "FIFA World Cup 2026",
    source: "OpenFootball worldcup.json",
    updatedAt,
    groups,
  };
}
