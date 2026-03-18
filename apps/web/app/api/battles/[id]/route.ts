import { NextResponse } from "next/server";
import { getBattleDetail } from "../../../../lib/repo";
import { cancelBattleJob } from "../../../../lib/jobs";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleDetail(id);
  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }
  return NextResponse.json(battle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported battle action" }, { status: 400 });
  }

  const result = await cancelBattleJob(id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: `Battle is already ${result.status}.` },
      { status: 409 }
    );
  }

  const battle = await getBattleDetail(id);
  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  return NextResponse.json(battle);
}
