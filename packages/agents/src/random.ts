import type { AgentDecisionInput, AgentDecisionOutput } from "@poke-bench/shared";
import type { Agent } from "./interface";

export class RandomAgent implements Agent {
  id: string;
  name: string;

  constructor(id: string, name: string = "RandomAgent") {
    this.id = id;
    this.name = name;
  }

  async decide(input: AgentDecisionInput): Promise<AgentDecisionOutput> {
    const { legalActions } = input;
    
    if (legalActions.length === 0) {
      return {
        action: "move 1",
        publicReasoning: "No legal actions available, defaulting to move 1",
        fallbackUsed: true,
      };
    }

    const chosen = legalActions[Math.floor(Math.random() * legalActions.length)];
    
    return {
      action: chosen!.id,
      publicReasoning: `Randomly selected: ${chosen!.label}`,
      confidence: 1 / legalActions.length,
      fallbackUsed: false,
    };
  }
}
