export type LiveScoreFixture = {
  provider: "api-football" | "football-data";
  providerFixtureId: string | number;
  utcDate?: string | null;
  statusShort: string | null;
  statusLong: string | null;
  elapsed: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type FetchLiveScoresInput = {
  date: string;
  timezone: string;
};
