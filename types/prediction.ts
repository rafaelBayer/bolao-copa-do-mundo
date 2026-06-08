export type Prediction = {
  id: string;
  poolId: string;
  userId: string;
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
  createdAt: string;
  updatedAt: string;
};
