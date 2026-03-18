import { NextResponse } from "next/server";
import { getRunDetail } from "../../../../lib/repo";
import { cancelRunJob } from "../../../../lib/jobs";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRunDetail(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(run);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported run action" }, { status: 400 });
  }

  const result = await cancelRunJob(id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: `Run is already ${result.status}.` },
      { status: 409 }
    );
  }

  const run = await getRunDetail(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
