import { prisma } from "@poke-bench/db";
import { CreateAgentInputSchema } from "@poke-bench/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const agents = await prisma.agent.findMany({
    orderBy: [{ provider: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  try {
    const input = CreateAgentInputSchema.parse(await request.json());
    if (
      (input.provider === "openai" || input.provider === "anthropic") &&
      !input.modelId?.trim()
    ) {
      return NextResponse.json(
        { error: "OpenAI and Anthropic agents require a selected model." },
        { status: 400 }
      );
    }
    const isProviderBacked = input.provider === "openai" || input.provider === "anthropic";
    let agent;

    if (isProviderBacked && input.modelId) {
      const existing = await prisma.agent.findFirst({
        where: {
          provider: input.provider,
          modelId: input.modelId,
        },
      });

      agent = existing
        ? await prisma.agent.update({
            where: { id: existing.id },
            data: {
              name: input.name,
              systemPrompt: input.systemPrompt ?? null,
              temperature: input.temperature ?? null,
              maxTokens: input.maxTokens ?? null,
            },
          })
        : await prisma.agent.create({
            data: {
              ...input,
              modelId: input.modelId,
              systemPrompt: input.systemPrompt ?? null,
              temperature: input.temperature ?? null,
              maxTokens: input.maxTokens ?? null,
            },
          });
    } else {
      agent = await prisma.agent.create({
        data: {
          ...input,
          modelId: input.modelId ?? null,
          systemPrompt: input.systemPrompt ?? null,
          temperature: input.temperature ?? null,
          maxTokens: input.maxTokens ?? null,
        },
      });
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
