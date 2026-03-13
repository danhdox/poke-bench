import type { AgentDecisionInput, AgentDecisionOutput, LegalAction } from "@poke-bench/shared";
import type { Agent } from "./interface.js";

const MOVE_BASE_POWERS: Record<string, number> = {
  "earthquake": 100,
  "rockslide": 75,
  "uturn": 70,
  "superpower": 120,
  "closecombat": 120,
  "aquajet": 40,
  "shadowball": 80,
  "moonblast": 95,
  "mysticalfire": 75,
  "dazzlinggleam": 80,
  "wildcharge": 90,
  "heavyslam": 100,
  "grassyglide": 70,
  "woodhammer": 120,
  "knockoff": 65,
  "flareblitz": 120,
  "astralbarrage": 120,
  "psyshock": 80,
  "pollenpuff": 90,
  "thunderbolt": 90,
  "sludgebomb": 90,
};

function getMovePower(moveId: string): number {
  const normalized = moveId.toLowerCase().replace(/[^a-z]/g, "");
  return MOVE_BASE_POWERS[normalized] ?? 60;
}

export class HeuristicAgent implements Agent {
  id: string;
  name: string;

  constructor(id: string, name: string = "HeuristicAgent") {
    this.id = id;
    this.name = name;
  }

  async decide(input: AgentDecisionInput): Promise<AgentDecisionOutput> {
    const { legalActions, requestType } = input;

    if (legalActions.length === 0) {
      return {
        action: "move 1",
        publicReasoning: "No legal actions, defaulting",
        fallbackUsed: true,
      };
    }

    if (requestType === "teamPreview") {
      return {
        action: legalActions[0]!.id,
        publicReasoning: "Using default team order",
        fallbackUsed: false,
      };
    }

    const moves = legalActions.filter((a) => a.kind === "move");
    const switches = legalActions.filter((a) => a.kind === "switch");

    if (moves.length > 0) {
      let bestMove: LegalAction = moves[0]!;
      let bestPower = getMovePower(bestMove.id);

      for (const move of moves) {
        const power = getMovePower(move.id);
        if (power > bestPower) {
          bestPower = power;
          bestMove = move;
        }
      }

      return {
        action: bestMove.id,
        publicReasoning: `Heuristic: highest power move (${bestMove.label}, ~${bestPower} BP)`,
        confidence: 0.7,
        fallbackUsed: false,
      };
    }

    if (switches.length > 0) {
      return {
        action: switches[0]!.id,
        publicReasoning: "Forced switch",
        fallbackUsed: false,
      };
    }

    return {
      action: legalActions[0]!.id,
      publicReasoning: "Fallback to first legal action",
      fallbackUsed: true,
    };
  }
}
