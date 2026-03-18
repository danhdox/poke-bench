import { prisma } from "@poke-bench/db";
import { CreateRunInputSchema, CreateRunRequestSchema } from "@poke-bench/shared";
import { NextResponse } from "next/server";
import { enqueueRunJob } from "../../../lib/jobs";
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
  if (!checkRateLimit(`run:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const input = CreateRunRequestSchema.parse(await request.json());
    const uniqueModels = new Set(input.models.map((model) => `${model.provider}:${model.modelId}`));
    if (uniqueModels.size < 2) {
      return NextResponse.json({ error: "Select at least two models" }, { status: 400 });
    }
    if (new Set(input.teamIds).size < 2) {
      return NextResponse.json({ error: "Select at least two teams" }, { status: 400 });
    }

    const [{ models, catalogStates }, teams] = await Promise.all([
      getBattleModelSetup(true),
      prisma.team.findMany({
        where: {
          id: {
            in: input.teamIds,
          },
        },
      }),
    ]);

    input.models.forEach((model, index) => {
      requireBattleModelOption(models, catalogStates, model, `Model ${index + 1}`);
    });

    if (teams.length !== input.teamIds.length) {
      return NextResponse.json(
        { error: "Every selected team must exist before you can start a benchmark run." },
        { status: 400 }
      );
    }
    if (teams.some((team) => team.validationStatus !== "valid")) {
      return NextResponse.json(
        { error: "Every selected team must be valid before you can start a benchmark run." },
        { status: 400 }
      );
    }
    if (teams.some((team) => team.formatId !== input.formatId)) {
      return NextResponse.json(
        { error: "Selected teams must match the chosen benchmark format." },
        { status: 400 }
      );
    }

    const agents = await Promise.all(
      input.models.map((model) => resolveBattleModelAgent(model, models))
    );
    const resolvedConfig = CreateRunInputSchema.parse({
      name: input.name,
      formatId: input.formatId,
      agentIds: agents.map((agent) => agent.id),
      teamIds: input.teamIds,
      gamesPerPairing: input.gamesPerPairing,
      mirror: input.mirror,
      maxTurns: input.maxTurns,
    });

    const run = await prisma.tournamentRun.create({
      data: {
        name: resolvedConfig.name,
        status: "pending",
        configJson: JSON.stringify(resolvedConfig),
        participants: {
          create: resolvedConfig.agentIds.map((agentId) => ({ agentId })),
        },
      },
    });

    enqueueRunJob(run.id);
    return NextResponse.json({ id: run.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: formatRequestError(error) }, { status: 400 });
  }
}
