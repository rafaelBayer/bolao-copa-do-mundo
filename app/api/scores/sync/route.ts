import { NextRequest, NextResponse } from "next/server";
import { runLiveScoreSync } from "@/lib/scores/runLiveScoreSync";

export const dynamic = "force-dynamic";

function validateSecret(request: NextRequest) {
  const expectedSecret = process.env.SCORES_SYNC_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-sync-secret");

  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

export async function GET(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json(
      { status: "error", reason: "unauthorized" },
      { status: 401 },
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
        reason: "missing_supabase_server_env",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
