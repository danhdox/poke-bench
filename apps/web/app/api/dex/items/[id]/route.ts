import { getItem } from "@poke-bench/dex";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const entry = getItem(id);
  if (!entry) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json(entry);
}
