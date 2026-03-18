import { searchDex } from "@poke-bench/dex";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(searchDex("move", q));
}
