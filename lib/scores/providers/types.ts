export type LiveScoreFixture = {
  provider: "api-football" | "football-data" | "worldcup26" | "espn";
  providerFixtureId: string | number;
  utcDate?: string | null;
  matchday?: number | null;
  statusShort: string | null;
  statusLong: string | null;
  elapsed: number | null;
  homeTeamName: string | null;
  homeTeamCode?: string | null;
  awayTeamName: string | null;
  awayTeamCode?: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type FetchLiveScoresInput = {
  date: string;
  timezone: string;
};
