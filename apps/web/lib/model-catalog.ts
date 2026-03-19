export type ModelOption = {
  id: string;
  name: string;
  summary: string;
};

export const MODEL_CATALOG = {
  random: {
    label: "Random baseline",
    description: "Samples directly from the legal action list. No external model required.",
    models: [],
  },
  heuristic: {
    label: "Heuristic baseline",
    description: "Uses a lightweight ruleset to prefer stronger move labels. No external model required.",
    models: [],
  },
  openai: {
    label: "OpenAI",
    description: "Preset model options for the server-side OpenAI battle agent.",
    models: [
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        summary: "Fast default preset for cheap battle loops.",
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        summary: "Stronger general model when you want a higher-quality policy.",
      },
    ],
  },
  anthropic: {
    label: "Anthropic",
    description: "Preset model options for the server-side Anthropic battle agent.",
    models: [
      {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        summary: "Fast Anthropic preset for cheaper battle loops.",
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        summary: "Balanced default Anthropic preset for stronger tactical play.",
      },
      {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        summary: "High-end Anthropic preset for deeper battle comparisons.",
      },
    ],
  },
} as const;

export type ModelCatalogProvider = keyof typeof MODEL_CATALOG;
export type ModelCatalogStatus = "ready" | "missing_key" | "error";
export type ModelCatalogSource = "live" | "fallback";
export type SupportedBattleProvider = Exclude<ModelCatalogProvider, "random" | "heuristic">;

export type ProviderCatalog = {
  provider: ModelCatalogProvider;
  label: string;
  description: string;
  models: ModelOption[];
  source: ModelCatalogSource;
  status: ModelCatalogStatus;
  fetchedAt: string;
  error?: string;
};

export function getProviderCatalog(provider: string) {
  return MODEL_CATALOG[(provider as ModelCatalogProvider) ?? "random"] ?? MODEL_CATALOG.random;
}

export function getSupportedBattleModels(provider: SupportedBattleProvider) {
  return [...MODEL_CATALOG[provider].models];
}

export function getSupportedBattleModel(provider: SupportedBattleProvider, modelId: string) {
  return MODEL_CATALOG[provider].models.find((model) => model.id === modelId) ?? null;
}

export function getFallbackProviderCatalog(
  provider: ModelCatalogProvider,
  status: ModelCatalogStatus = "ready",
  error?: string
): ProviderCatalog {
  const catalog = getProviderCatalog(provider);
  return {
    provider,
    label: catalog.label,
    description: catalog.description,
    models: [...catalog.models],
    source: "fallback",
    status,
    fetchedAt: new Date().toISOString(),
    error,
  };
}
