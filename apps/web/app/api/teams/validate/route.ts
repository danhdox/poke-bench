import { ValidateTeamInputSchema } from "@poke-bench/shared";
import { validateTeam } from "@poke-bench/sim";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = ValidateTeamInputSchema.parse(await request.json());
    const result = validateTeam(input.importable, input.formatId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
