import type {
  AgentConfig,
  AgentDecisionInput,
  AgentDecisionOutput,
  TokenUsage,
} from "@poke-bench/shared";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a competitive Pokemon doubles battle agent.",
  "Choose exactly one action from the legal action ids you are given.",
  "Do not invent moves, switches, targets, or hidden information.",
  "Return only a JSON object with keys action, publicReasoning, and confidence.",
  "Return a short public rationale only.",
].join(" ");

export function buildInstructions(config: AgentConfig): string {
  return config.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
}

export function buildPrompt(input: AgentDecisionInput): string {
  return JSON.stringify(
    {
      battleId: input.battleId,
      turn: input.turn,
      attempt: input.attempt ?? 1,
      side: input.side,
      formatId: input.formatId,
      requestType: input.requestType,
      observation: input.observation,
      legalActions: input.legalActions,
      previousValidationError: input.validationError,
      responseRules: {
        mustChooseOneLegalActionId: true,
        includeShortPublicReasoning: true,
        jsonObjectOnly: true,
        noHiddenKnowledge: true,
      },
      expectedJson: {
        action: "legal action id",
        publicReasoning: "short explanation",
        confidence: 0.0,
      },
    },
    null,
    2
  );
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Fall through to fenced/snippet extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      // Fall through to object slicing.
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractOpenAITokenUsage(
  response: { usage?: { input_tokens?: number; output_tokens?: number } | null; incomplete_details?: { reason?: string | null } | null },
  modelId: string,
  parseMode: TokenUsage["parseMode"]
): TokenUsage {
  const inputTokens = response.usage?.input_tokens ?? null;
  const outputTokens = response.usage?.output_tokens ?? null;
  return {
    provider: "openai",
    modelId,
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens === null && outputTokens === null
        ? null
        : (inputTokens ?? 0) + (outputTokens ?? 0),
    estimatedCostUsd: null,
    parseMode,
    stopReason: response.incomplete_details?.reason ?? null,
  };
}

export function extractAnthropicTokenUsage(
  response: {
    usage?: {
      input_tokens?: number | null;
      output_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
      cache_read_input_tokens?: number | null;
    } | null;
    stop_reason?: string | null;
  },
  modelId: string
): TokenUsage {
  const inputTokens =
    (response.usage?.input_tokens ?? 0) +
    (response.usage?.cache_creation_input_tokens ?? 0) +
    (response.usage?.cache_read_input_tokens ?? 0);
  const outputTokens = response.usage?.output_tokens ?? null;
  const normalizedInputTokens =
    inputTokens === 0 && response.usage?.input_tokens == null ? null : inputTokens;
  return {
    provider: "anthropic",
    modelId,
    inputTokens: normalizedInputTokens,
    outputTokens,
    totalTokens:
      normalizedInputTokens === null && outputTokens === null
        ? null
        : (normalizedInputTokens ?? 0) + (outputTokens ?? 0),
    estimatedCostUsd: null,
    parseMode: "json_prompt",
    stopReason: response.stop_reason ?? null,
  };
}

export function mergeTokenUsage(
  usages: Array<TokenUsage | undefined>,
  meta?: Partial<Pick<TokenUsage, "attempts" | "repairAttempts">>
): TokenUsage | undefined {
  const valid = usages.filter((usage): usage is TokenUsage => Boolean(usage));
  if (valid.length === 0 && !meta) return undefined;

  const first = valid[0];
  return {
    provider: first?.provider,
    modelId: first?.modelId,
    inputTokens: valid.reduce(
      (sum, usage) => sum + (usage.inputTokens ?? 0),
      0
    ),
    outputTokens: valid.reduce(
      (sum, usage) => sum + (usage.outputTokens ?? 0),
      0
    ),
    totalTokens: valid.reduce(
      (sum, usage) =>
        sum + (usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
      0
    ),
    estimatedCostUsd:
      valid.every((usage) => usage.estimatedCostUsd != null)
        ? valid.reduce((sum, usage) => sum + (usage.estimatedCostUsd ?? 0), 0)
        : null,
    parseMode: first?.parseMode,
    stopReason: valid.at(-1)?.stopReason ?? null,
    attempts: meta?.attempts ?? valid.length,
    repairAttempts: meta?.repairAttempts ?? Math.max(0, valid.length - 1),
  };
}

export function normalizeDecision(
  parsed: Record<string, unknown> | null,
  rawResponse: unknown,
  tokenUsage?: TokenUsage
): AgentDecisionOutput {
  return {
    action: typeof parsed?.action === "string" ? parsed.action : "",
    publicReasoning:
      typeof parsed?.publicReasoning === "string" ? parsed.publicReasoning : undefined,
    confidence:
      typeof parsed?.confidence === "number" ? parsed.confidence : undefined,
    tokenUsage,
    rawResponse,
  };
}
