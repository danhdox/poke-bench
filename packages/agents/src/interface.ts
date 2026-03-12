import type { AgentDecisionInput, AgentDecisionOutput } from "@poke-bench/shared";

export interface Agent {
  id: string;
  name: string;
  decide(input: AgentDecisionInput): Promise<AgentDecisionOutput>;
}
