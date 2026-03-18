import { prisma } from "@poke-bench/db";
import type { BattleModelSelection } from "@poke-bench/shared";
import { getProviderModelCatalog } from "./model-discovery";

export type BattleModelOption = {
  key: string;
  provider: "openai" | "anthropic";
  providerLabel: string;
  modelId: string;
  name: string;
  summary: string;
};

export type BattleModelCatalogState = {
  provider: "openai" | "anthropic";
  providerLabel: string;
  status: "ready" | "missing_key" | "error";
  error?: string;
};

export async function getBattleModelSetup(force = false) {
  const [openaiCatalog, anthropicCatalog] = await Promise.all([
    getProviderModelCatalog("openai", force),
    getProviderModelCatalog("anthropic", force),
  ]);

  const catalogs = [openaiCatalog, anthropicCatalog] as const;
  const models: BattleModelOption[] = catalogs.flatMap((catalog) =>
    catalog.models.map((model) => ({
      key: `${catalog.provider}:${model.id}`,
      provider: catalog.provider as "openai" | "anthropic",
      providerLabel: catalog.label,
      modelId: model.id,
      name: model.name,
      summary: model.summary,
    }))
  );

  const catalogStates: BattleModelCatalogState[] = catalogs.map((catalog) => ({
    provider: catalog.provider as "openai" | "anthropic",
    providerLabel: catalog.label,
    status: catalog.status,
    error: catalog.error,
  }));

  return {
    models,
    catalogStates,
  };
}

export function findBattleModelOption(
  models: BattleModelOption[],
  selection: BattleModelSelection
) {
  return (
    models.find(
      (model) =>
        model.provider === selection.provider && model.modelId === selection.modelId
    ) ?? null
  );
}

export function requireBattleModelOption(
  models: BattleModelOption[],
  catalogStates: BattleModelCatalogState[],
  selection: BattleModelSelection,
  label: string
) {
  const match = findBattleModelOption(models, selection);
  if (match) {
    return match;
  }

  const state = catalogStates.find((entry) => entry.provider === selection.provider);
  if (!state || state.status === "missing_key") {
    throw new Error(`${state?.providerLabel ?? selection.provider} is not configured on the server.`);
  }
  if (state.status === "error") {
    throw new Error(
      `${state.providerLabel} models are currently unavailable. ${state.error ?? "Try again shortly."}`
    );
  }

  throw new Error(`${label} must use a supported live ${selection.provider} model.`);
}

export async function resolveBattleModelAgent(
  selection: BattleModelSelection,
  models: BattleModelOption[]
) {
  const model = findBattleModelOption(models, selection);
  if (!model) {
    throw new Error(
      `${selection.provider} model "${selection.modelId}" is not available with the current server configuration.`
    );
  }

  const existing = await prisma.agent.findFirst({
    where: {
      provider: model.provider,
      modelId: model.modelId,
    },
  });

  if (existing) {
    return prisma.agent.update({
      where: { id: existing.id },
      data: {
        name: model.name,
        systemPrompt: null,
        temperature: null,
        maxTokens: null,
      },
    });
  }

  return prisma.agent.create({
    data: {
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      systemPrompt: null,
      temperature: null,
      maxTokens: null,
    },
  });
}
