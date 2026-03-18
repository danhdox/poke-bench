import { NextResponse } from "next/server";
import { getBattleDetail } from "../../../../../lib/repo";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleDetail(id);
  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }
  return NextResponse.json(battle.turns);
}
