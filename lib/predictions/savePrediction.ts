import { createClient } from "@/lib/supabase/client";
import type { Prediction } from "@/types/prediction";

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

  const { data, error } = await supabase
    .from("predictions")
    .upsert(
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
    )
    .select(
      "id, pool_id, user_id, match_id, home_score, away_score, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    poolId: String(data.pool_id),
    userId: String(data.user_id),
    matchId: String(data.match_id),
    homeScore: typeof data.home_score === "number" ? data.home_score : null,
    awayScore: typeof data.away_score === "number" ? data.away_score : null,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  } satisfies Prediction;
}
