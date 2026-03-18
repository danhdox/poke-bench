import { getPokemon } from "@poke-bench/dex";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const entry = getPokemon(id);
  if (!entry) {
    return NextResponse.json({ error: "Pokemon not found" }, { status: 404 });
  }
  return NextResponse.json(entry);
}
