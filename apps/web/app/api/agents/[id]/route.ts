import { prisma } from "@poke-bench/db";
import { UpdateAgentInputSchema } from "@poke-bench/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = UpdateAgentInputSchema.parse(await request.json());
    if (
      (input.provider === "openai" || input.provider === "anthropic") &&
      !input.modelId?.trim()
    ) {
      return NextResponse.json(
        { error: "OpenAI and Anthropic agents require a selected model." },
        { status: 400 }
      );
    }
    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...input,
        modelId: input.modelId ?? undefined,
        systemPrompt: input.systemPrompt ?? undefined,
        temperature: input.temperature ?? undefined,
        maxTokens: input.maxTokens ?? undefined,
      },
    });
    return NextResponse.json(agent);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
