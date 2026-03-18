import { prisma } from "@poke-bench/db";
import { CreateTeamInputSchema } from "@poke-bench/shared";
import { validateTeam } from "@poke-bench/sim";
import { NextResponse } from "next/server";
import { ensureDefaultBattleTeams } from "../../../lib/default-battle-teams";

export const runtime = "nodejs";

export async function GET() {
  await ensureDefaultBattleTeams();

  const teams = await prisma.team.findMany({
    orderBy: [{ formatId: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  try {
    const input = CreateTeamInputSchema.parse(await request.json());
    const validation = validateTeam(input.importable, input.formatId);
    const existing = await prisma.team.findFirst({
      where: {
        name: input.name,
        formatId: input.formatId,
      },
    });
    const team = existing
      ? await prisma.team.update({
          where: { id: existing.id },
          data: {
            importable: input.importable,
            validationStatus: validation.valid ? "valid" : "invalid",
            validationErrors: validation.valid ? null : validation.errors.join("\n"),
          },
        })
      : await prisma.team.create({
          data: {
            name: input.name,
            formatId: input.formatId,
            importable: input.importable,
            validationStatus: validation.valid ? "valid" : "invalid",
            validationErrors: validation.valid ? null : validation.errors.join("\n"),
          },
        });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
