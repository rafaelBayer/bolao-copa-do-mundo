import type { GroupTableRow, GroupWithTeamsAndMatches } from "@/types/group";
import { calculateGroupStandings } from "./calculateGroupStandings";

export function calculateGroupTable(
  group: GroupWithTeamsAndMatches,
): GroupTableRow[] {
  const scoresByMatchId = new Map(
    group.matches.map((match) => [
      match.id,
      {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
    ]),
  );
  const { standings } = calculateGroupStandings({
    teams: group.teams,
    matches: group.matches,
    scoresByMatchId,
  });

  return standings.map((row) => ({
    team: {
      id: row.teamId,
      name: row.teamName,
      code: row.teamCode,
      flagUrl: row.flagUrl,
    },
    points: row.points,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
  }));
}
