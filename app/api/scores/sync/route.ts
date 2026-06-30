import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "Esta rota não está disponível.",
    },
    { status: 410 },
  );
}
