import type { AgentConfig } from "@poke-bench/shared";
import type { Agent } from "./interface";
import { AnthropicAgent } from "./anthropic";
import { HeuristicAgent } from "./heuristic";
import { OpenAIAgent } from "./openai";
import { RandomAgent } from "./random";

export function createAgent(config: AgentConfig): Agent {
  switch (config.provider) {
    case "random":
      return new RandomAgent(config.id, config.name);
    case "heuristic":
      return new HeuristicAgent(config.id, config.name);
    case "openai":
      return new OpenAIAgent(config);
    case "anthropic":
      return new AnthropicAgent(config);
    default:
      return new RandomAgent(config.id, config.name);
  }
}
