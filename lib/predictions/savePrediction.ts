import { createClient } from "@/lib/supabase/client";

type SavePredictionInput = {
  poolId: string;
  userId: string;
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
};

export async function savePrediction({
  poolId,
  userId,
  matchId,
  homeScore,
  awayScore,
}: SavePredictionInput) {
  const supabase = createClient();

  const { error } = await supabase.from("predictions").upsert(
    {
      pool_id: poolId,
      user_id: userId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "pool_id,user_id,match_id",
    },
  );

  if (error) {
    throw error;
  }
}
