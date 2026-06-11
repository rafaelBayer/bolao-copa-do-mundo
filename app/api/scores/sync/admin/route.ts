import { NextResponse } from "next/server";
import { runLiveScoreSync } from "@/lib/scores/runLiveScoreSync";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json(
      { status: "error", reason: "unauthorized" },
      { status: 401 },
    );
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("pool_id, role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!membership?.pool_id || membership.role !== "owner") {
    return NextResponse.json(
      { status: "error", reason: "forbidden" },
      { status: 403 },
    );
  }

  try {
    const result = await runLiveScoreSync();
    const status = result.status === "error" ? 502 : 200;

    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        reason: "sync_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
