import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "Esta rota nao esta disponivel.",
    },
    { status: 410 },
  );
}
