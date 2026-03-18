import OpenAI from "openai";
import { ensureServerEnvLoaded } from "@poke-bench/shared";
import type {
  AgentConfig,
  AgentDecisionInput,
  AgentDecisionOutput,
} from "@poke-bench/shared";
import type { Agent } from "./interface";
import {
  buildInstructions,
  buildPrompt,
  extractOpenAITokenUsage,
  extractJsonObject,
  normalizeDecision,
} from "./llm";

function canRetryWithoutSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? error.status : undefined;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return (
    status === 400 &&
    (message.includes("json_schema") ||
      message.includes("structured outputs") ||
      message.includes("response format") ||
      message.includes("response_format") ||
      message.includes("invalid schema") ||
      message.includes("required is required"))
  );
}

ensureServerEnvLoaded();

export class OpenAIAgent implements Agent {
  id: string;
  name: string;
  private readonly config: AgentConfig;
  private readonly client: OpenAI;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    if (!config.modelId) {
      throw new Error("OpenAI agents require a modelId");
    }

    this.client = new OpenAI({ apiKey });
  }

  async decide(input: AgentDecisionInput): Promise<AgentDecisionOutput> {
    const baseRequest = {
      model: this.config.modelId!,
      instructions: buildInstructions(this.config),
      input: buildPrompt(input),
      temperature: this.config.temperature,
      max_output_tokens: this.config.maxTokens ?? 250,
    } as const;

    try {
      const response = await this.client.responses.create({
        ...baseRequest,
        text: {
          format: {
            type: "json_schema",
            name: "battle_action",
            strict: true,
            schema: {
              type: "object",
              properties: {
                action: { type: "string" },
                publicReasoning: { type: ["string", "null"] },
                confidence: { type: ["number", "null"] },
              },
              required: ["action", "publicReasoning", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = extractJsonObject(response.output_text ?? "");
      return normalizeDecision(
        parsed,
        response,
        extractOpenAITokenUsage(response, this.config.modelId!, "json_schema")
      );
    } catch (error) {
      if (!canRetryWithoutSchema(error)) {
        throw error;
      }
    }

    const fallbackResponse = await this.client.responses.create(baseRequest);
    const parsed = extractJsonObject(fallbackResponse.output_text ?? "");
    return normalizeDecision(
      parsed,
      fallbackResponse,
      extractOpenAITokenUsage(fallbackResponse, this.config.modelId!, "json_prompt")
    );
  }
}
