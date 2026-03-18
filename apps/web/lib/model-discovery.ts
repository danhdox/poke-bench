import {
  getFallbackProviderCatalog,
  getSupportedBattleModel,
  type ModelCatalogProvider,
  type ModelOption,
  type ProviderCatalog,
} from "./model-catalog";
import { ensureServerEnvLoaded } from "@poke-bench/shared";

const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

ensureServerEnvLoaded();

type CacheEntry = {
  expiresAt: number;
  value: ProviderCatalog;
};

const globalState = globalThis as typeof globalThis & {
  __pokeBenchModelCatalogCache?: Map<ModelCatalogProvider, CacheEntry>;
};

const cache =
  globalState.__pokeBenchModelCatalogCache ??
  new Map<ModelCatalogProvider, CacheEntry>();

globalState.__pokeBenchModelCatalogCache = cache;

function isLikelyOpenAIBattleModel(id: string) {
  const value = id.toLowerCase();
  return (
    (value.startsWith("gpt") || /^o[1-9]/.test(value)) &&
    !value.includes("embedding") &&
    !value.includes("moderation") &&
    !value.includes("whisper") &&
    !value.includes("transcribe") &&
    !value.includes("tts") &&
    !value.includes("image") &&
    !value.includes("realtime") &&
    !value.includes("search")
  );
}

function isLikelyAnthropicBattleModel(id: string) {
  return id.toLowerCase().includes("claude");
}

function sortModelOptions(models: ModelOption[]) {
  return [...models].sort((left, right) => left.id.localeCompare(right.id));
}

type OpenAIModelsResponse = {
  data?: Array<{
    id: string;
    owned_by?: string;
  }>;
};

type AnthropicModelsResponse = {
  data?: Array<{
    id: string;
    display_name?: string;
    created_at: string;
  }>;
};

async function discoverOpenAIModels(): Promise<ProviderCatalog> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getEmptySupportedProviderCatalog(
      "openai",
      "missing_key",
      "OPENAI_API_KEY is not configured on the server."
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`OpenAI model fetch failed with ${response.status}`);
    }
    const payload = (await response.json()) as OpenAIModelsResponse;
    const models = sortModelOptions(
      (payload.data ?? [])
        .filter((model) => isLikelyOpenAIBattleModel(model.id))
        .flatMap((model) => {
          const supportedModel = getSupportedBattleModel("openai", model.id);
          if (!supportedModel) {
            return [];
          }

          return [
            {
              id: model.id,
              name: supportedModel.name,
              summary:
                supportedModel.summary ||
                (model.owned_by ? `Live provider listing · ${model.owned_by}` : "Live provider listing"),
            } satisfies ModelOption,
          ];
        })
    );

    if (models.length === 0) {
      return getEmptySupportedProviderCatalog(
        "openai",
        "error",
        "No supported OpenAI battle models were returned by the provider."
      );
    }

    return {
      provider: "openai",
      label: "OpenAI",
      description: "Live server-fetched OpenAI model list. Stored model ids still live in the database.",
      models,
      source: "live",
      status: "ready",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return getEmptySupportedProviderCatalog(
      "openai",
      "error",
      error instanceof Error ? error.message : "Failed to fetch OpenAI models."
    );
  }
}

async function discoverAnthropicModels(): Promise<ProviderCatalog> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return getEmptySupportedProviderCatalog(
      "anthropic",
      "missing_key",
      "ANTHROPIC_API_KEY is not configured on the server."
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Anthropic model fetch failed with ${response.status}`);
    }
    const payload = (await response.json()) as AnthropicModelsResponse;
    const models = sortModelOptions(
      (payload.data ?? [])
        .filter((model) => isLikelyAnthropicBattleModel(model.id))
        .flatMap((model) => {
          const supportedModel = getSupportedBattleModel("anthropic", model.id);
          if (!supportedModel) {
            return [];
          }

          return [
            {
              id: model.id,
              name: supportedModel.name,
              summary:
                supportedModel.summary ||
                `Live provider listing · released ${model.created_at.slice(0, 10)}`,
            } satisfies ModelOption,
          ];
        })
    );

    if (models.length === 0) {
      return getEmptySupportedProviderCatalog(
        "anthropic",
        "error",
        "No supported Anthropic battle models were returned by the provider."
      );
    }

    return {
      provider: "anthropic",
      label: "Anthropic",
      description:
        "Live server-fetched Anthropic model list. Stored model ids still live in the database.",
      models,
      source: "live",
      status: "ready",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return getEmptySupportedProviderCatalog(
      "anthropic",
      "error",
      error instanceof Error ? error.message : "Failed to fetch Anthropic models."
    );
  }
}

export async function getProviderModelCatalog(
  provider: ModelCatalogProvider,
  force = false
): Promise<ProviderCatalog> {
  if (provider === "random" || provider === "heuristic") {
    return getFallbackProviderCatalog(provider);
  }

  if (!force) {
    const cached = cache.get(provider);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const value =
    provider === "openai" ? await discoverOpenAIModels() : await discoverAnthropicModels();

  cache.set(provider, {
    expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
    value,
  });

  return value;
}

export function getEmptySupportedProviderCatalog(
  provider: "openai" | "anthropic",
  status: "missing_key" | "error",
  error: string
): ProviderCatalog {
  const fallback = getFallbackProviderCatalog(provider, status, error);
  return {
    ...fallback,
    description: `${fallback.description} Only confirmed live supported models are selectable for battles.`,
    models: [],
  };
}
