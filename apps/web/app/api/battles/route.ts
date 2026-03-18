import { prisma } from "@poke-bench/db";
import { CreateBattleInputSchema } from "@poke-bench/shared";
import { NextResponse } from "next/server";
import { enqueueBattleJob } from "../../../lib/jobs";
import {
  getBattleModelSetup,
  requireBattleModelOption,
  resolveBattleModelAgent,
} from "../../../lib/battle-setup";
import { formatRequestError } from "../../../lib/request-errors";
import { checkRateLimit } from "../../../lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`battle:${ip}`, 12, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const input = CreateBattleInputSchema.parse(await request.json());
    const [{ models, catalogStates }, teams] = await Promise.all([
      getBattleModelSetup(true),
      prisma.team.findMany({
        where: {
          id: {
            in: [input.team1Id, input.team2Id],
          },
        },
      }),
    ]);

    requireBattleModelOption(models, catalogStates, input.model1, "Model 1");
    requireBattleModelOption(models, catalogStates, input.model2, "Model 2");

    const team1 = teams.find((team) => team.id === input.team1Id);
    const team2 = teams.find((team) => team.id === input.team2Id);

    if (!team1 || !team2) {
      throw new Error("Both selected teams must exist before you can start a battle.");
    }
    if (team1.validationStatus !== "valid" || team2.validationStatus !== "valid") {
      throw new Error("Both selected teams must be valid before you can start a battle.");
    }
    if (team1.formatId !== input.formatId || team2.formatId !== input.formatId) {
      throw new Error("Selected teams must match the chosen battle format.");
    }

    const [agent1, agent2] = await Promise.all([
      resolveBattleModelAgent(input.model1, models),
      resolveBattleModelAgent(input.model2, models),
    ]);

    const battle = await prisma.battle.create({
      data: {
        status: "pending",
        formatId: input.formatId,
        agent1Id: agent1.id,
        agent2Id: agent2.id,
        team1Id: input.team1Id,
        team2Id: input.team2Id,
        configJson: JSON.stringify({
          maxTurns: input.maxTurns ?? 200,
          model1: input.model1,
          model2: input.model2,
        }),
      },
    });
    enqueueBattleJob(battle.id);
    return NextResponse.json({ id: battle.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: formatRequestError(error) }, { status: 400 });
  }
}
