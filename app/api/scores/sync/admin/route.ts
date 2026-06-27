import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    {
      error: "Esta rota nao esta disponivel.",
    },
    { status: 410 },
  );
}
