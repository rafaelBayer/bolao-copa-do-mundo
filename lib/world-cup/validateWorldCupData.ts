import type {
  WorldCupGroupSeed,
  WorldCupMatchSeed,
  WorldCupSeedData,
  WorldCupTeamSeed,
} from "../../types/worldCupData";

export type WorldCupValidationResult = {
  valid: boolean;
  errors: string[];
  summary: {
    groups: number;
    teams: number;
    matches: number;
  };
};

const expectedGroups = 12;
const expectedTeams = 48;
const expectedMatches = 72;
const expectedTeamsPerGroup = 4;
const expectedMatchesPerGroup = 6;
const expectedMatchesPerRound = 2;
const expectedMatchesPerTeam = 3;
const validRounds = new Set([1, 2, 3]);

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

function countTeams(groups: WorldCupGroupSeed[]) {
  return groups.reduce((total, group) => total + group.teams.length, 0);
}

function countMatches(groups: WorldCupGroupSeed[]) {
  return groups.reduce((total, group) => total + group.matches.length, 0);
}

function isValidDateString(value: string) {
  const timestamp = Date.parse(value);

  return !Number.isNaN(timestamp);
}

function groupLabel(group: WorldCupGroupSeed, index: number) {
  return group.name.trim() || `Group at index ${index}`;
}

function matchLabel(
  group: WorldCupGroupSeed,
  groupIndex: number,
  match: WorldCupMatchSeed,
  matchIndex: number,
) {
  const numberLabel =
    match.fifaMatchNumber === undefined
      ? `match ${matchIndex + 1}`
      : `match #${match.fifaMatchNumber}`;

  return `${groupLabel(group, groupIndex)} ${numberLabel}`;
}

function addDuplicateError<TKey extends string | number>(
  errors: string[],
  seen: Map<TKey, string>,
  key: TKey,
  owner: string,
  label: string,
) {
  const previousOwner = seen.get(key);

  if (previousOwner) {
    errors.push(`${label} "${key}" is duplicated in ${previousOwner} and ${owner}.`);
    return;
  }

  seen.set(key, owner);
}

function validateGeneralStructure(
  data: WorldCupSeedData,
  groups: WorldCupGroupSeed[],
  errors: string[],
) {
  const seenGroupNames = new Map<string, string>();

  if (!data.tournament.trim()) {
    errors.push("Tournament name is required.");
  }

  if (!data.source.trim()) {
    errors.push("Source is required.");
  }

  if (!data.updatedAt.trim()) {
    errors.push("updatedAt is required.");
  } else if (!isValidDateString(data.updatedAt)) {
    errors.push(`updatedAt "${data.updatedAt}" is not a valid date string.`);
  }

  if (groups.length !== expectedGroups) {
    errors.push(
      `Expected exactly ${expectedGroups} groups, found ${groups.length}.`,
    );
  }

  const teams = countTeams(groups);

  if (teams !== expectedTeams) {
    errors.push(`Expected exactly ${expectedTeams} teams, found ${teams}.`);
  }

  const matches = countMatches(groups);

  if (matches !== expectedMatches) {
    errors.push(
      `Expected exactly ${expectedMatches} group matches, found ${matches}.`,
    );
  }

  groups.forEach((group, groupIndex) => {
    const name = group.name.trim();

    if (name) {
      addDuplicateError(
        errors,
        seenGroupNames,
        normalizeName(name),
        `group ${groupIndex + 1}`,
        "Group name",
      );
    }
  });
}

function validateTeams(
  groups: WorldCupGroupSeed[],
  errors: string[],
  teamCodesByGroup: Map<string, Set<string>>,
) {
  const seenCodes = new Map<string, string>();
  const seenNames = new Map<string, string>();

  groups.forEach((group, groupIndex) => {
    const currentGroupLabel = groupLabel(group, groupIndex);
    const groupTeamCodes = new Set<string>();

    if (!group.name.trim()) {
      errors.push(`Group at index ${groupIndex} is missing name.`);
    }

    if (group.teams.length !== expectedTeamsPerGroup) {
      errors.push(
        `${currentGroupLabel}: expected exactly ${expectedTeamsPerGroup} teams, found ${group.teams.length}.`,
      );
    }

    group.teams.forEach((team: WorldCupTeamSeed, teamIndex) => {
      const teamOwner = `${currentGroupLabel} team ${teamIndex + 1}`;
      const name = team.name.trim();
      const code = normalizeCode(team.code);

      if (!name) {
        errors.push(`${teamOwner}: team name is required.`);
      } else {
        addDuplicateError(errors, seenNames, normalizeName(name), teamOwner, "Team name");
      }

      if (!code) {
        errors.push(`${teamOwner}: team code is required.`);
      } else {
        addDuplicateError(errors, seenCodes, code, teamOwner, "Team code");
        groupTeamCodes.add(code);
      }
    });

    teamCodesByGroup.set(group.name, groupTeamCodes);
  });
}

function validateMatchRounds(
  group: WorldCupGroupSeed,
  groupIndex: number,
  errors: string[],
) {
  [1, 2, 3].forEach((roundNumber) => {
    const matchesInRound = group.matches.filter(
      (match) => match.roundNumber === roundNumber,
    );

    if (matchesInRound.length !== expectedMatchesPerRound) {
      errors.push(
        `${groupLabel(group, groupIndex)}: round ${roundNumber} must have exactly ${expectedMatchesPerRound} matches, found ${matchesInRound.length}.`,
      );
    }
  });
}

function validateMatches(
  groups: WorldCupGroupSeed[],
  errors: string[],
  teamCodesByGroup: Map<string, Set<string>>,
) {
  const allTeamCodes = new Set(
    groups.flatMap((group) =>
      group.teams.map((team) => normalizeCode(team.code)).filter(Boolean),
    ),
  );
  const seenFifaMatchNumbers = new Map<number, string>();

  groups.forEach((group, groupIndex) => {
    const currentGroupLabel = groupLabel(group, groupIndex);
    const groupTeamCodes = teamCodesByGroup.get(group.name) ?? new Set<string>();
    const teamMatchCounts = new Map<string, number>();
    const seenPairings = new Set<string>();

    if (group.matches.length !== expectedMatchesPerGroup) {
      errors.push(
        `${currentGroupLabel}: expected exactly ${expectedMatchesPerGroup} matches, found ${group.matches.length}.`,
      );
    }

    validateMatchRounds(group, groupIndex, errors);

    group.matches.forEach((match, matchIndex) => {
      const currentMatchLabel = matchLabel(group, groupIndex, match, matchIndex);
      const homeTeamCode = normalizeCode(match.homeTeamCode);
      const awayTeamCode = normalizeCode(match.awayTeamCode);

      if (!validRounds.has(match.roundNumber)) {
        errors.push(
          `${currentMatchLabel}: roundNumber must be 1, 2, or 3, found ${match.roundNumber}.`,
        );
      }

      if (!homeTeamCode) {
        errors.push(`${currentMatchLabel}: homeTeamCode is required.`);
      }

      if (!awayTeamCode) {
        errors.push(`${currentMatchLabel}: awayTeamCode is required.`);
      }

      if (homeTeamCode && awayTeamCode && homeTeamCode === awayTeamCode) {
        errors.push(
          `${currentMatchLabel}: homeTeamCode and awayTeamCode cannot be the same (${homeTeamCode}).`,
        );
      }

      [homeTeamCode, awayTeamCode].forEach((teamCode) => {
        if (!teamCode) {
          return;
        }

        if (!allTeamCodes.has(teamCode)) {
          errors.push(`${currentMatchLabel}: team ${teamCode} does not exist.`);
        } else if (!groupTeamCodes.has(teamCode)) {
          errors.push(
            `${currentMatchLabel}: team ${teamCode} does not belong to ${currentGroupLabel}.`,
          );
        }
      });

      if (homeTeamCode && awayTeamCode && homeTeamCode !== awayTeamCode) {
        const pairingKey = [homeTeamCode, awayTeamCode].sort().join(":");

        if (seenPairings.has(pairingKey)) {
          errors.push(
            `${currentMatchLabel}: duplicated matchup ${homeTeamCode} vs ${awayTeamCode} in ${currentGroupLabel}.`,
          );
        }

        seenPairings.add(pairingKey);
      }

      [homeTeamCode, awayTeamCode].forEach((teamCode) => {
        if (teamCode && groupTeamCodes.has(teamCode)) {
          teamMatchCounts.set(teamCode, (teamMatchCounts.get(teamCode) ?? 0) + 1);
        }
      });

      if (match.fifaMatchNumber !== undefined) {
        addDuplicateError(
          errors,
          seenFifaMatchNumbers,
          match.fifaMatchNumber,
          currentMatchLabel,
          "FIFA match number",
        );
      }

      if (match.kickoffAt && !isValidDateString(match.kickoffAt)) {
        errors.push(
          `${currentMatchLabel}: kickoffAt "${match.kickoffAt}" is not a valid date string.`,
        );
      }
    });

    groupTeamCodes.forEach((teamCode) => {
      const matchCount = teamMatchCounts.get(teamCode) ?? 0;

      if (matchCount !== expectedMatchesPerTeam) {
        errors.push(
          `${currentGroupLabel}: team ${teamCode} must play exactly ${expectedMatchesPerTeam} matches, found ${matchCount}.`,
        );
      }
    });
  });
}

export function validateWorldCupData(
  data: WorldCupSeedData,
): WorldCupValidationResult {
  const errors: string[] = [];
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const teamCodesByGroup = new Map<string, Set<string>>();

  validateGeneralStructure(data, groups, errors);
  validateTeams(groups, errors, teamCodesByGroup);
  validateMatches(groups, errors, teamCodesByGroup);

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      groups: groups.length,
      teams: countTeams(groups),
      matches: countMatches(groups),
    },
  };
}
