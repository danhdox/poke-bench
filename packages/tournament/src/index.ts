import type {
  AgentMetrics,
  CreateRunInput,
  TournamentBattleConfig,
  TournamentSummaryJson,
} from "@poke-bench/shared";

type BattleLike = {
  winnerAgentId: string | null;
  agent1Id: string;
  agent2Id: string;
  turnCount: number;
  turns: Array<{
    actingSide: "p1" | "p2";
    latencyMs: number;
    fallbackUsed: boolean;
  }>;
};

export function buildRoundRobinSchedule(input: CreateRunInput): TournamentBattleConfig[] {
  const gamesPerPairing = input.gamesPerPairing ?? 1;
  const mirror = input.mirror ?? true;
  const battles: TournamentBattleConfig[] = [];

  for (let i = 0; i < input.agentIds.length; i++) {
    for (let j = i + 1; j < input.agentIds.length; j++) {
      for (let teamA = 0; teamA < input.teamIds.length; teamA++) {
        for (let teamB = 0; teamB < input.teamIds.length; teamB++) {
          for (let game = 0; game < gamesPerPairing; game++) {
            battles.push({
              agent1Id: input.agentIds[i]!,
              agent2Id: input.agentIds[j]!,
              team1Id: input.teamIds[teamA]!,
              team2Id: input.teamIds[teamB]!,
            });

            if (mirror) {
              battles.push({
                agent1Id: input.agentIds[j]!,
                agent2Id: input.agentIds[i]!,
                team1Id: input.teamIds[teamA]!,
                team2Id: input.teamIds[teamB]!,
              });
            }
          }
        }
      }
    }
  }

  return battles;
}

export function summarizeRun(
  input: CreateRunInput,
  agentNames: Map<string, string>,
  battles: BattleLike[]
): TournamentSummaryJson {
  const standings = new Map<string, AgentMetrics>();

  const ensure = (agentId: string) => {
    if (!standings.has(agentId)) {
      standings.set(agentId, {
        agentId,
        agentName: agentNames.get(agentId) ?? agentId,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageTurns: 0,
        averageLatencyMs: 0,
        fallbackRate: 0,
        invalidActionRate: 0,
        timeoutRate: 0,
        estimatedCostUsd: 0,
      });
    }
    return standings.get(agentId)!;
  };

  for (const battle of battles) {
    const a1 = ensure(battle.agent1Id);
    const a2 = ensure(battle.agent2Id);
    const battleLatencies = battle.turns.map((turn) => turn.latencyMs);
    const avgLatency =
      battleLatencies.length === 0
        ? 0
        : battleLatencies.reduce((sum, value) => sum + value, 0) / battleLatencies.length;
    const fallbackRate =
      battle.turns.length === 0
        ? 0
        : battle.turns.filter((turn) => turn.fallbackUsed).length / battle.turns.length;

    a1.averageTurns += battle.turnCount;
    a2.averageTurns += battle.turnCount;
    a1.averageLatencyMs += avgLatency;
    a2.averageLatencyMs += avgLatency;
    a1.fallbackRate += fallbackRate;
    a2.fallbackRate += fallbackRate;

    if (battle.winnerAgentId === battle.agent1Id) {
      a1.wins += 1;
      a2.losses += 1;
    } else if (battle.winnerAgentId === battle.agent2Id) {
      a2.wins += 1;
      a1.losses += 1;
    }
  }

  const completedBattles = battles.length;
  const ordered = Array.from(standings.values())
    .map((entry) => {
      const total = entry.wins + entry.losses;
      return {
        ...entry,
        winRate: total === 0 ? 0 : entry.wins / total,
        averageTurns: completedBattles === 0 ? 0 : entry.averageTurns / completedBattles,
        averageLatencyMs:
          completedBattles === 0 ? 0 : entry.averageLatencyMs / completedBattles,
        fallbackRate: completedBattles === 0 ? 0 : entry.fallbackRate / completedBattles,
      };
    })
    .sort((left, right) => right.winRate - left.winRate || right.wins - left.wins);

  return {
    mode: "roundRobin",
    formatId: input.formatId,
    gamesPerPairing: input.gamesPerPairing ?? 1,
    mirror: input.mirror ?? true,
    totalBattles: buildRoundRobinSchedule(input).length,
    completedBattles,
    standings: ordered,
  };
}
