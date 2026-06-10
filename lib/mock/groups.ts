import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { MatchWithTeams, Team } from "@/types/match";

function team(id: string, name: string, code: string): Team {
  return {
    id,
    name,
    code,
    flagUrl: null,
  };
}

function match(
  id: string,
  groupId: string,
  roundNumber: number,
  homeTeam: Team,
  awayTeam: Team,
): MatchWithTeams {
  return {
    id,
    groupId,
    fifaMatchNumber: null,
    roundNumber,
    matchDate: null,
    kickoffAt: null,
    stadium: null,
    city: null,
    country: null,
    homeScore: null,
    awayScore: null,
    apiFootballFixtureId: null,
    statusShort: null,
    statusLong: null,
    elapsed: null,
    homeScoreLive: null,
    awayScoreLive: null,
    scoreUpdatedAt: null,
    homeTeam,
    awayTeam,
  };
}

export const mockGroups: GroupWithTeamsAndMatches[] = Array.from(
  { length: 8 },
  (_, groupIndex) => {
    const letter = String.fromCharCode(65 + groupIndex);
    const groupId = `mock-group-${letter.toLowerCase()}`;
    const teams = [1, 2, 3, 4].map((position) =>
      team(
        `mock-team-${letter.toLowerCase()}${position}`,
        `Selecao ${letter}${position}`,
        `${letter}${position}`,
      ),
    );

    return {
      id: groupId,
      name: `Grupo ${letter}`,
      teams,
      matches: [
        match(`${groupId}-m1`, groupId, 1, teams[0], teams[1]),
        match(`${groupId}-m2`, groupId, 1, teams[2], teams[3]),
        match(`${groupId}-m3`, groupId, 2, teams[0], teams[2]),
        match(`${groupId}-m4`, groupId, 2, teams[3], teams[1]),
        match(`${groupId}-m5`, groupId, 3, teams[3], teams[0]),
        match(`${groupId}-m6`, groupId, 3, teams[1], teams[2]),
      ],
    };
  },
);
