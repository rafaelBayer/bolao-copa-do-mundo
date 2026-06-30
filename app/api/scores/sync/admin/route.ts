import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    {
      error: "Esta rota não está disponível.",
    },
    { status: 410 },
  );
}
