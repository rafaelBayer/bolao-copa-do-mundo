import { createClient } from "@/lib/supabase/client";
import type { Prediction } from "@/types/prediction";

type SavePredictionInput = {
  poolId?: string;
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

  const rpcPayload = poolId
    ? {
        target_pool_id: poolId,
        target_match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      }
    : {
        target_match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      };

  const { data, error } = await supabase.rpc("save_prediction", rpcPayload);

  if (error) {
    throw error;
  }

  const savedPrediction = Array.isArray(data) ? data[0] : data;

  if (!savedPrediction) {
    throw new Error("Não foi possível salvar o palpite.");
  }

  return {
    id: String(savedPrediction.id),
    poolId:
      typeof savedPrediction.pool_id === "string"
        ? savedPrediction.pool_id
        : poolId ?? "",
    userId,
    matchId: String(savedPrediction.match_id),
    homeScore:
      typeof savedPrediction.home_score === "number"
        ? savedPrediction.home_score
        : null,
    awayScore:
      typeof savedPrediction.away_score === "number"
        ? savedPrediction.away_score
        : null,
    createdAt: String(savedPrediction.created_at),
    updatedAt: String(savedPrediction.updated_at),
  } satisfies Prediction;
}
