import type { MatchWithTeams, Team } from "@/types/match";

export type GroupStandingRow = {
  teamId: string;
  teamName: string;
  teamCode: string | null;
  flagUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type MatchScore = {
  homeScore: number | null;
  awayScore: number | null;
};

type CalculateGroupStandingsInput = {
  teams: Team[];
  matches: MatchWithTeams[];
  scoresByMatchId: Map<string, MatchScore | undefined>;
};

export function calculateGroupStandings({
  teams,
  matches,
  scoresByMatchId,
}: CalculateGroupStandingsInput) {
  const rows = new Map<string, GroupStandingRow>();
  let countedMatches = 0;

  teams.forEach((team) => {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      teamCode: team.code,
      flagUrl: team.flagUrl,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  matches.forEach((match) => {
    const score = scoresByMatchId.get(match.id);

    if (!score || score.homeScore === null || score.awayScore === null) {
      return;
    }

    const home = rows.get(match.homeTeam.id);
    const away = rows.get(match.awayTeam.id);

    if (!home || !away) {
      return;
    }

    countedMatches += 1;
    home.played += 1;
    away.played += 1;
    home.goalsFor += score.homeScore;
    home.goalsAgainst += score.awayScore;
    away.goalsFor += score.awayScore;
    away.goalsAgainst += score.homeScore;

    if (score.homeScore > score.awayScore) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (score.homeScore < score.awayScore) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  const standings = Array.from(rows.values())
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) {
        return b.goalDifference - a.goalDifference;
      }
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamName.localeCompare(b.teamName);
    });

  return {
    countedMatches,
    standings,
  };
}
