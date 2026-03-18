import { prisma } from "@poke-bench/db";
import type { BattleSummaryJson, TournamentSummaryJson } from "@poke-bench/shared";
import { ensureDefaultBattleTeams } from "./default-battle-teams";
import { MODEL_CATALOG } from "./model-catalog";
import { safeJsonParse } from "./utils";

export async function getAgents() {
  return prisma.agent.findMany({
    orderBy: [{ provider: "asc" }, { name: "asc" }],
  });
}

export async function getTeams(options?: { ensureDefaults?: boolean }) {
  if (options?.ensureDefaults) {
    await ensureDefaultBattleTeams();
  }

  return prisma.team.findMany({
    orderBy: [{ formatId: "asc" }, { name: "asc" }],
  });
}

export async function getRecentBattles(limit = 8) {
  return prisma.battle.findMany({
    include: {
      agent1: true,
      agent2: true,
      team1: true,
      team2: true,
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function getActiveBattles(limit = 8) {
  return prisma.battle.findMany({
    where: {
      status: {
        in: ["pending", "running"],
      },
      tournamentBattles: {
        none: {},
      },
    },
    include: {
      agent1: true,
      agent2: true,
      team1: true,
      team2: true,
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function getRecentRuns(limit = 6) {
  return prisma.tournamentRun.findMany({
    include: {
      participants: {
        include: { agent: true },
      },
      battles: {
        include: {
          battle: {
            include: {
              agent1: true,
              agent2: true,
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function getActiveRuns(limit = 6) {
  return prisma.tournamentRun.findMany({
    where: {
      status: {
        in: ["pending", "running"],
      },
    },
    include: {
      participants: {
        include: { agent: true },
      },
      battles: {
        include: {
          battle: {
            select: {
              status: true,
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function getBattleDetail(id: string) {
  const battle = await prisma.battle.findUnique({
    where: { id },
    include: {
      agent1: true,
      agent2: true,
      team1: true,
      team2: true,
      turns: {
        orderBy: [{ turnNumber: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!battle) return null;

  return {
    ...battle,
    summary: safeJsonParse<BattleSummaryJson>(battle.summaryJson, {
      log: [],
      parsedTurns: [],
    }),
    config: safeJsonParse<Record<string, unknown>>(battle.configJson, {}),
  };
}

export async function getRunDetail(id: string) {
  const run = await prisma.tournamentRun.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          agent: true,
        },
      },
      battles: {
        include: {
          battle: {
            include: {
              agent1: true,
              agent2: true,
              team1: true,
              team2: true,
            },
          },
        },
      },
    },
  });

  if (!run) return null;

  return {
    ...run,
    config: safeJsonParse<Record<string, unknown>>(run.configJson, {}),
    summary: safeJsonParse<TournamentSummaryJson | null>(run.summaryJson, null),
  };
}

export async function getLeaderboard() {
  const battles = await prisma.battle.findMany({
    where: { status: "completed" },
    include: {
      agent1: true,
      agent2: true,
      turns: true,
    },
  });

  const table = new Map<
    string,
    {
      id: string;
      name: string;
      wins: number;
      losses: number;
      turns: number;
      latency: number;
      fallbacks: number;
      decisions: number;
    }
  >();

  for (const battle of battles) {
    const agents = [battle.agent1, battle.agent2];
    for (const agent of agents) {
      if (!table.has(agent.id)) {
        table.set(agent.id, {
          id: agent.id,
          name: agent.name,
          wins: 0,
          losses: 0,
          turns: 0,
          latency: 0,
          fallbacks: 0,
          decisions: 0,
        });
      }
    }

    const agent1 = table.get(battle.agent1.id)!;
    const agent2 = table.get(battle.agent2.id)!;
    agent1.turns += battle.turnCount;
    agent2.turns += battle.turnCount;

    for (const turn of battle.turns) {
      const entry = table.get(turn.actingSide === "p1" ? battle.agent1.id : battle.agent2.id);
      if (entry) {
        entry.latency += turn.latencyMs;
        entry.decisions += 1;
        if (turn.fallbackUsed) entry.fallbacks += 1;
      }
    }

    if (battle.winnerAgentId === battle.agent1.id) {
      agent1.wins += 1;
      agent2.losses += 1;
    } else if (battle.winnerAgentId === battle.agent2.id) {
      agent2.wins += 1;
      agent1.losses += 1;
    }
  }

  return Array.from(table.values())
    .map((entry) => {
      const matches = entry.wins + entry.losses;
      return {
        ...entry,
        winRate: matches === 0 ? 0 : entry.wins / matches,
        averageTurns: matches === 0 ? 0 : entry.turns / matches,
        averageLatencyMs: entry.decisions === 0 ? 0 : entry.latency / entry.decisions,
        fallbackRate: entry.decisions === 0 ? 0 : entry.fallbacks / entry.decisions,
      };
    })
    .sort((left, right) => right.winRate - left.winRate || right.wins - left.wins);
}

export type SupportedModelBenchmark = {
  provider: "openai" | "anthropic";
  providerLabel: string;
  modelId: string;
  modelName: string;
  battles: number;
  wins: number;
  losses: number;
  winRate: number | null;
  averageTurns: number | null;
};

export async function getSupportedModelBenchmarks(): Promise<SupportedModelBenchmark[]> {
  const providers = ["openai", "anthropic"] as const;
  const benchmarkTable = new Map<
    string,
    SupportedModelBenchmark & {
      totalTurns: number;
    }
  >();

  for (const provider of providers) {
    const catalog = MODEL_CATALOG[provider];
    for (const model of catalog.models) {
      benchmarkTable.set(`${provider}:${model.id}`, {
        provider,
        providerLabel: catalog.label,
        modelId: model.id,
        modelName: model.name,
        battles: 0,
        wins: 0,
        losses: 0,
        winRate: null,
        averageTurns: null,
        totalTurns: 0,
      });
    }
  }

  const battles = await prisma.battle.findMany({
    where: { status: "completed" },
    select: {
      turnCount: true,
      winnerAgentId: true,
      agent1: {
        select: {
          id: true,
          provider: true,
          modelId: true,
        },
      },
      agent2: {
        select: {
          id: true,
          provider: true,
          modelId: true,
        },
      },
    },
  });

  for (const battle of battles) {
    for (const agent of [battle.agent1, battle.agent2]) {
      if (!agent.modelId) continue;

      const row = benchmarkTable.get(`${agent.provider}:${agent.modelId}`);
      if (!row) continue;

      row.battles += 1;
      row.totalTurns += battle.turnCount;

      if (battle.winnerAgentId === agent.id) {
        row.wins += 1;
      } else if (battle.winnerAgentId) {
        row.losses += 1;
      }
    }
  }

  return Array.from(benchmarkTable.values())
    .map(({ totalTurns, ...row }) => ({
      ...row,
      winRate: row.battles === 0 ? null : row.wins / row.battles,
      averageTurns: row.battles === 0 ? null : totalTurns / row.battles,
    }))
    .sort((left, right) => {
      if (left.battles === 0 && right.battles > 0) return 1;
      if (right.battles === 0 && left.battles > 0) return -1;
      if (left.winRate !== null && right.winRate !== null && left.winRate !== right.winRate) {
        return right.winRate - left.winRate;
      }
      if (left.battles !== right.battles) {
        return right.battles - left.battles;
      }
      if (left.providerLabel !== right.providerLabel) {
        return left.providerLabel.localeCompare(right.providerLabel);
      }
      return left.modelName.localeCompare(right.modelName);
    });
}

export async function getDashboardData() {
  const [recentBattles, recentRuns, leaderboard] = await Promise.all([
    getRecentBattles(6),
    getRecentRuns(4),
    getLeaderboard(),
  ]);

  return {
    recentBattles,
    recentRuns,
    leaderboard: leaderboard.slice(0, 5),
  };
}
