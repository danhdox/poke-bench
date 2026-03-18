import Anthropic from "@anthropic-ai/sdk";
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
  extractAnthropicTokenUsage,
  extractJsonObject,
  normalizeDecision,
} from "./llm";

ensureServerEnvLoaded();

export class AnthropicAgent implements Agent {
  id: string;
  name: string;
  private readonly config: AgentConfig;
  private readonly client: Anthropic;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    if (!config.modelId) {
      throw new Error("Anthropic agents require a modelId");
    }

    this.client = new Anthropic({ apiKey });
  }

  async decide(input: AgentDecisionInput): Promise<AgentDecisionOutput> {
    const response = await this.client.messages.create({
      model: this.config.modelId!,
      max_tokens: this.config.maxTokens ?? 250,
      temperature: this.config.temperature,
      system: buildInstructions(this.config),
      messages: [
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
    });

    const text = response.content
      .map((entry) => ("text" in entry ? entry.text : ""))
      .join("\n");
    const parsed = extractJsonObject(text);
    return normalizeDecision(
      parsed,
      response,
      extractAnthropicTokenUsage(response, this.config.modelId!)
    );
  }
}
