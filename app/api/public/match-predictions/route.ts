import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPredictionVisible(kickoffAt: string | null) {
  if (!kickoffAt) {
    return false;
  }

  return Date.now() >= new Date(kickoffAt).getTime() - 60 * 60 * 1000;
}

function fallbackName(row: Record<string, unknown>) {
  if (typeof row.name === "string" && row.name.trim()) {
    return row.name;
  }

  if (typeof row.username === "string" && row.username.trim()) {
    return row.username;
  }

  return "Participante";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const poolId = url.searchParams.get("poolId");
  const matchId = url.searchParams.get("matchId");

  if (!poolId || !matchId || !uuidPattern.test(poolId) || !uuidPattern.test(matchId)) {
    return NextResponse.json({ predictions: [] }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: pool }, { data: match }] = await Promise.all([
    admin
      .from("pools")
      .select("id, type, is_default")
      .eq("id", poolId)
      .maybeSingle(),
    admin
      .from("matches")
      .select("id, kickoff_at")
      .eq("id", matchId)
      .maybeSingle(),
  ]);

  if (!pool || pool.type !== "general" || pool.is_default !== true) {
    return NextResponse.json({ predictions: [] }, { status: 403 });
  }

  if (!match || !isPredictionVisible(match.kickoff_at)) {
    return NextResponse.json({ predictions: [] });
  }

  const { data: members } = await admin
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId);
  const userIds = (members ?? [])
    .map((row) => String(row.user_id))
    .filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({ predictions: [] });
  }

  const [{ data: profiles }, { data: predictions }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", userIds),
    admin
      .from("predictions")
      .select("user_id, home_score, away_score, updated_at, created_at, id")
      .eq("match_id", matchId)
      .in("user_id", userIds)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("updated_at", { ascending: false }),
  ]);
  const profileByUserId = new Map(
    ((profiles ?? []) as Record<string, unknown>[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const latestByUserId = new Map<string, Record<string, unknown>>();

  ((predictions ?? []) as Record<string, unknown>[]).forEach((prediction) => {
    const userId = String(prediction.user_id);

    if (!latestByUserId.has(userId)) {
      latestByUserId.set(userId, prediction);
    }
  });

  return NextResponse.json({
    predictions: Array.from(latestByUserId.entries()).map(
      ([userId, prediction]) => {
        const profile = profileByUserId.get(userId);

        return {
          user_id: userId,
          participant_name: profile ? fallbackName(profile) : "Participante",
          participant_avatar_url:
            typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
          is_current_user: false,
          home_score:
            typeof prediction.home_score === "number"
              ? prediction.home_score
              : 0,
          away_score:
            typeof prediction.away_score === "number"
              ? prediction.away_score
              : 0,
          updated_at: String(prediction.updated_at),
        };
      },
    ),
  });
}
