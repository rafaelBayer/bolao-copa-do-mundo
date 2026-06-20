import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "disabled",
      reason: "live_score_sync_not_available_in_auth_mvp",
    },
    { status: 410 },
  );
}
