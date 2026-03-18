import { createAgent, mergeTokenUsage } from "@poke-bench/agents";
import { prisma } from "@poke-bench/db";
import { buildRoundRobinSchedule, summarizeRun } from "@poke-bench/tournament";
import { parseBattleLog, runBattle } from "@poke-bench/sim";
import type {
  AgentConfig,
  AgentDecisionOutput,
  CreateRunInput,
} from "@poke-bench/shared";
import { safeJsonParse } from "./utils";

type QueueState = {
  battles: Map<string, Promise<void>>;
  runs: Map<string, Promise<void>>;
};

const TERMINAL_BATTLE_STATUSES = new Set(["completed", "failed", "cancelled"]);
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);

class BattleCancelledError extends Error {
  constructor(message = "Battle cancelled by user.") {
    super(message);
    this.name = "BattleCancelledError";
  }
}

const globalState = globalThis as typeof globalThis & {
  __pokeBenchQueue?: QueueState;
};

const queue =
  globalState.__pokeBenchQueue ??
  ({
    battles: new Map<string, Promise<void>>(),
    runs: new Map<string, Promise<void>>(),
  } satisfies QueueState);

globalState.__pokeBenchQueue = queue;

function toAgentConfig(agent: {
  id: string;
  name: string;
  provider: string;
  modelId: string | null;
  systemPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
}): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    provider: agent.provider as AgentConfig["provider"],
    modelId: agent.modelId ?? undefined,
    systemPrompt: agent.systemPrompt ?? undefined,
    temperature: agent.temperature ?? undefined,
    maxTokens: agent.maxTokens ?? undefined,
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serializeRaw(value: unknown) {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ value: String(value) });
  }
}

function normalizeReasoning(reasoning?: string, fallbackMessage?: string) {
  if (!fallbackMessage) return reasoning;
  return reasoning ? `${reasoning} ${fallbackMessage}` : fallbackMessage;
}

function getEmptyBattleSummary() {
  return {
    log: [] as string[],
    parsedTurns: [] as Array<{
      turn: number;
      lines: string[];
      moves: { pokemon: string; move: string; target?: string }[];
      fainted: string[];
      weather?: string;
    }>,
  };
}

function getCancelledBattleSummary(summaryJson: string | null | undefined) {
  const summary = safeJsonParse(summaryJson, getEmptyBattleSummary());
  return {
    ...summary,
    error: "Battle cancelled by user.",
  };
}

async function ensureBattleNotCancelled(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: { status: true },
  });

  if (!battle || battle.status === "cancelled") {
    throw new BattleCancelledError();
  }
}

export async function cancelBattleJob(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      status: true,
      summaryJson: true,
    },
  });

  if (!battle) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (TERMINAL_BATTLE_STATUSES.has(battle.status)) {
    return { ok: false as const, reason: "not_stoppable" as const, status: battle.status };
  }

  await prisma.battle.update({
    where: { id: battleId },
    data: {
      status: "cancelled",
      completedAt: new Date(),
      summaryJson: JSON.stringify(getCancelledBattleSummary(battle.summaryJson)),
    },
  });

  return { ok: true as const };
}

async function isRunCancelled(runId: string) {
  const run = await prisma.tournamentRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });

  return !run || run.status === "cancelled";
}

export async function cancelRunJob(runId: string) {
  const run = await prisma.tournamentRun.findUnique({
    where: { id: runId },
    include: {
      battles: {
        select: {
          battleId: true,
        },
      },
    },
  });

  if (!run) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (TERMINAL_RUN_STATUSES.has(run.status)) {
    return { ok: false as const, reason: "not_stoppable" as const, status: run.status };
  }

  await prisma.tournamentRun.update({
    where: { id: runId },
    data: {
      status: "cancelled",
      completedAt: new Date(),
    },
  });

  await Promise.all(run.battles.map((battle) => cancelBattleJob(battle.battleId)));

  return { ok: true as const };
}

async function decideWithRecovery(
  agent: ReturnType<typeof createAgent>,
  input: Parameters<ReturnType<typeof createAgent>["decide"]>[0],
  legalChoices: string[]
) {
  const attempts: AgentDecisionOutput[] = [];
  let validationError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let decision: AgentDecisionOutput;

    try {
      decision = await agent.decide({
        ...input,
        attempt,
        validationError,
      });
    } catch (error) {
      decision = {
        action: "",
        publicReasoning: `Agent error: ${toErrorMessage(error)}`,
        fallbackUsed: true,
        rawResponse: { error: toErrorMessage(error) },
      };
    }

    attempts.push(decision);
    const chosenAction = decision.action.trim();
    if (legalChoices.includes(chosenAction)) {
      return {
        decision,
        chosenAction,
        fallbackUsed: Boolean(decision.fallbackUsed),
        publicReasoning: decision.publicReasoning,
        rawResponse: attempts.map((entry, index) => ({
          attempt: index + 1,
          action: entry.action,
          rawResponse: entry.rawResponse,
        })),
        tokenUsage: mergeTokenUsage(attempts.map((entry) => entry.tokenUsage), {
          attempts: attempts.length,
          repairAttempts: Math.max(0, attempts.length - 1),
        }),
      };
    }

    validationError =
      chosenAction.length > 0
        ? `The action "${chosenAction}" is not legal. Choose exactly one id from the legalActions list.`
        : "Your last response did not produce a valid action id. Return exactly one legal action id in JSON.";
  }

  const fallbackAction = legalChoices[0] ?? "move 1";
  const lastDecision = attempts.at(-1);
  return {
    decision: lastDecision,
    chosenAction: fallbackAction,
    fallbackUsed: true,
    publicReasoning: normalizeReasoning(
      lastDecision?.publicReasoning,
      `Fallback applied after repeated invalid outputs. Final fallback: ${fallbackAction}.`
    ),
    rawResponse: attempts.map((entry, index) => ({
      attempt: index + 1,
      action: entry.action,
      rawResponse: entry.rawResponse,
    })),
    tokenUsage: mergeTokenUsage(attempts.map((entry) => entry.tokenUsage), {
      attempts: attempts.length,
      repairAttempts: Math.max(0, attempts.length - 1),
    }),
  };
}

async function persistRunSummary(runId: string, config: CreateRunInput) {
  const run = await prisma.tournamentRun.findUnique({
    where: { id: runId },
    include: {
      participants: {
        include: { agent: true },
      },
      battles: {
        include: {
          battle: {
            include: {
              turns: true,
            },
          },
        },
      },
    },
  });

  if (!run) return;

  const summary = summarizeRun(
    config,
    new Map(run.participants.map((participant) => [participant.agentId, participant.agent.name])),
    run.battles
      .map((entry) => entry.battle)
      .filter((battle) => battle.status === "completed")
      .map((battle) => ({
        winnerAgentId: battle.winnerAgentId,
        agent1Id: battle.agent1Id,
        agent2Id: battle.agent2Id,
        turnCount: battle.turnCount,
        turns: battle.turns.map((turn) => ({
          actingSide: turn.actingSide as "p1" | "p2",
          latencyMs: turn.latencyMs,
          fallbackUsed: turn.fallbackUsed,
        })),
      }))
  );

  await prisma.tournamentRun.update({
    where: { id: runId },
    data: {
      summaryJson: JSON.stringify(summary),
    },
  });
}

async function executeBattle(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      agent1: true,
      agent2: true,
      team1: true,
      team2: true,
      tournamentBattles: true,
    },
  });

  if (!battle) return;

  if (battle.status === "cancelled") {
    return;
  }

  const started = await prisma.battle.updateMany({
    where: {
      id: battleId,
      status: {
        in: ["pending", "running"],
      },
    },
    data: {
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      summaryJson: JSON.stringify({ log: [], parsedTurns: [] }),
    },
  });

  if (started.count === 0) {
    return;
  }

  try {
    const agent1 = createAgent(toAgentConfig(battle.agent1));
    const agent2 = createAgent(toAgentConfig(battle.agent2));
    const config = safeJsonParse<Record<string, unknown>>(battle.configJson, {});
    const maxTurns =
      typeof config.maxTurns === "number" && Number.isFinite(config.maxTurns)
        ? config.maxTurns
        : 200;

    await prisma.battleTurn.deleteMany({
      where: { battleId },
    });

    const result = await runBattle(
      battle.team1.importable,
      battle.team2.importable,
      battle.formatId,
      async (context) => {
        await ensureBattleNotCancelled(battleId);

        const actingAgent = context.side === "p1" ? agent1 : agent2;
        const startedAt = Date.now();
        const resolved = await decideWithRecovery(
          actingAgent,
          {
            battleId,
            turn: context.turn,
            side: context.side,
            formatId: battle.formatId,
            requestType: context.requestType,
            legalActions: context.legalActions,
            observation: {
              ...context.observation,
              battleId,
            },
          },
          context.legalChoices
        );

        await ensureBattleNotCancelled(battleId);

        await prisma.battleTurn.create({
          data: {
            battleId,
            turnNumber: context.turn,
            actingSide: context.side,
            requestType: context.requestType,
            observationJson: JSON.stringify({
              observation: {
                ...context.observation,
                battleId,
              },
              request: context.request,
            }),
            legalActionsJson: JSON.stringify(context.legalActions),
            chosenAction: resolved.chosenAction,
            publicReasoning: resolved.publicReasoning,
            confidence: resolved.decision?.confidence ?? null,
            latencyMs: Date.now() - startedAt,
            tokenUsageJson: serializeRaw(resolved.tokenUsage),
            fallbackUsed: resolved.fallbackUsed,
            rawModelResponseJson: serializeRaw(resolved.rawResponse),
            logChunk: context.recentLog.join("\n"),
          },
        });

        return resolved.chosenAction;
      },
      maxTurns
    );

    const parsed = parseBattleLog(result.log);

    const latestBattle = await prisma.battle.findUnique({
      where: { id: battleId },
      select: { status: true },
    });

    if (!latestBattle || latestBattle.status === "cancelled") {
      return;
    }

    await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: result.error ? "failed" : "completed",
        winnerSide:
          result.winner === "p1" || result.winner === "p2" ? result.winner : null,
        winnerAgentId:
          result.winner === "p1"
            ? battle.agent1Id
            : result.winner === "p2"
            ? battle.agent2Id
            : null,
        turnCount: result.turns,
        completedAt: new Date(),
        summaryJson: JSON.stringify({
          log: result.log,
          parsedTurns: parsed.turns,
          error: result.error,
        }),
      },
    });
  } catch (error) {
    if (error instanceof BattleCancelledError) {
      const latestBattle = await prisma.battle.findUnique({
        where: { id: battleId },
        select: {
          status: true,
          summaryJson: true,
        },
      });

      if (latestBattle && latestBattle.status !== "cancelled") {
        await prisma.battle.update({
          where: { id: battleId },
          data: {
            status: "cancelled",
            completedAt: new Date(),
            summaryJson: JSON.stringify(getCancelledBattleSummary(latestBattle.summaryJson)),
          },
        });
      }
      return;
    }

    await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: "failed",
        completedAt: new Date(),
        summaryJson: JSON.stringify({
          log: [],
          parsedTurns: [],
          error: toErrorMessage(error),
        }),
      },
    });
  }

  const runLink = battle.tournamentBattles[0];
  if (runLink) {
    const run = await prisma.tournamentRun.findUnique({
      where: { id: runLink.runId },
    });
    if (run) {
      const config = safeJsonParse<CreateRunInput>(run.configJson, {
        name: run.name,
        formatId: battle.formatId,
        agentIds: [battle.agent1Id, battle.agent2Id],
        teamIds: [battle.team1Id, battle.team2Id],
      });
      await persistRunSummary(run.id, config);
    }
  }
}

async function executeRun(runId: string) {
  const run = await prisma.tournamentRun.findUnique({
    where: { id: runId },
    include: {
      participants: true,
      battles: true,
    },
  });

  if (!run) return;

  const config = safeJsonParse<CreateRunInput>(run.configJson, {
    name: run.name,
    formatId: "gen9vgc2024regg",
    agentIds: run.participants.map((participant) => participant.agentId),
    teamIds: [],
  });

  const started = await prisma.tournamentRun.updateMany({
    where: {
      id: runId,
      status: {
        in: ["pending", "running"],
      },
    },
    data: {
      status: "running",
      startedAt: new Date(),
      completedAt: null,
    },
  });

  if (started.count === 0) {
    return;
  }

  let battleIds: string[] = run.battles.map((battle) => battle.battleId);
  if (battleIds.length === 0) {
    const schedule = buildRoundRobinSchedule(config);
    battleIds = [];
    for (const matchup of schedule) {
      if (await isRunCancelled(runId)) {
        await persistRunSummary(runId, config);
        return;
      }

      const battle = await prisma.battle.create({
        data: {
          status: "pending",
          formatId: config.formatId,
          agent1Id: matchup.agent1Id,
          agent2Id: matchup.agent2Id,
          team1Id: matchup.team1Id,
          team2Id: matchup.team2Id,
          configJson: JSON.stringify({
            maxTurns: config.maxTurns ?? 200,
            runId,
          }),
        },
      });

      await prisma.tournamentBattle.create({
        data: {
          runId,
          battleId: battle.id,
        },
      });
      battleIds.push(battle.id);

      if (await isRunCancelled(runId)) {
        await cancelBattleJob(battle.id);
        await persistRunSummary(runId, config);
        return;
      }
    }
  }

  for (const battleId of battleIds) {
    if (await isRunCancelled(runId)) {
      await persistRunSummary(runId, config);
      return;
    }

    await executeBattle(battleId);

    if (await isRunCancelled(runId)) {
      await persistRunSummary(runId, config);
      return;
    }
  }

  await persistRunSummary(runId, config);

  const latestRun = await prisma.tournamentRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });

  if (!latestRun || latestRun.status === "cancelled") {
    return;
  }

  await prisma.tournamentRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });
}

export async function runBattleNow(battleId: string) {
  await executeBattle(battleId);
}

export function enqueueBattleJob(battleId: string) {
  if (queue.battles.has(battleId)) return;
  const job = executeBattle(battleId).finally(() => {
    queue.battles.delete(battleId);
  });
  queue.battles.set(battleId, job);
}

export function enqueueRunJob(runId: string) {
  if (queue.runs.has(runId)) return;
  const job = executeRun(runId).finally(() => {
    queue.runs.delete(runId);
  });
  queue.runs.set(runId, job);
}
