import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureServerEnvLoaded } from "../packages/shared/src/server-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
ensureServerEnvLoaded();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Add it to the repo-root .env.");
  }

  const { PrismaClient } = await import("@prisma/client");
  const { runBattle } = await import("../packages/sim/src/index.ts");
  const { RandomAgent } = await import("../packages/agents/src/index.ts");

  const prisma = new PrismaClient();

  const team1Path = join(__dirname, "../data/sample-teams/team1.txt");
  const team2Path = join(__dirname, "../data/sample-teams/team2.txt");

  if (!existsSync(team1Path) || !existsSync(team2Path)) {
    console.error("Sample teams not found at", team1Path, team2Path);
    process.exit(1);
  }

  const team1Text = readFileSync(team1Path, "utf-8");
  const team2Text = readFileSync(team2Path, "utf-8");

  const formatId = "gen9vgc2024regg";

  const agent1Db = await prisma.agent.create({
    data: { name: "RandomAgent-1", provider: "random" },
  });
  const agent2Db = await prisma.agent.create({
    data: { name: "RandomAgent-2", provider: "random" },
  });

  const team1Db = await prisma.team.create({
    data: {
      name: "Team Landorus",
      formatId,
      importable: team1Text,
      validationStatus: "valid",
    },
  });
  const team2Db = await prisma.team.create({
    data: {
      name: "Team Calyrex",
      formatId,
      importable: team2Text,
      validationStatus: "valid",
    },
  });

  const battleDb = await prisma.battle.create({
    data: {
      status: "running",
      formatId,
      agent1Id: agent1Db.id,
      agent2Id: agent2Db.id,
      team1Id: team1Db.id,
      team2Id: team2Db.id,
    },
  });

  console.log(`\n🎮 Starting Pokémon Battle!`);
  console.log(`   Battle ID: ${battleDb.id}`);
  console.log(`   Format: ${formatId}`);
  console.log(`   P1: ${agent1Db.name} (Team Landorus)`);
  console.log(`   P2: ${agent2Db.name} (Team Calyrex)\n`);

  const p1Agent = new RandomAgent(agent1Db.id, agent1Db.name);
  const p2Agent = new RandomAgent(agent2Db.id, agent2Db.name);

  const turnRecords: Array<{
    battleId: string;
    turnNumber: number;
    actingSide: string;
    requestType: string;
    chosenAction: string;
    publicReasoning?: string;
    confidence?: number;
    latencyMs: number;
    fallbackUsed: boolean;
  }> = [];

  let globalTurn = 0;

  const result = await runBattle(
    team1Text,
    team2Text,
    formatId,
    async ({ side, request, requestType, legalChoices, legalActions, observation, turn }) => {
      const agent = side === "p1" ? p1Agent : p2Agent;

      const start = Date.now();
      const decision = await agent.decide({
        battleId: battleDb.id,
        turn,
        side,
        formatId,
        requestType,
        legalActions,
        observation: { ...observation, battleId: battleDb.id },
      });
      const latencyMs = Date.now() - start;

      turnRecords.push({
        battleId: battleDb.id,
        turnNumber: turn,
        actingSide: side,
        requestType,
        observationJson: JSON.stringify({ request, observation }),
        legalActionsJson: JSON.stringify(legalChoices),
        chosenAction: decision.action,
        publicReasoning: decision.publicReasoning,
        confidence: decision.confidence,
        latencyMs,
        fallbackUsed: decision.fallbackUsed ?? false,
        rawModelResponseJson: decision.rawResponse
          ? JSON.stringify(decision.rawResponse)
          : null,
      });

      if (requestType !== "teamPreview") {
        globalTurn++;
        process.stdout.write(`  Turn ${globalTurn}: ${side} → ${decision.action}\n`);
      }

      return decision.action;
    }
  );

  if (turnRecords.length > 0) {
    await prisma.battleTurn.createMany({ data: turnRecords });
  }

  await prisma.battle.update({
    where: { id: battleDb.id },
    data: {
      status: result.error ? "failed" : "completed",
      winnerSide: result.winner === "draw" ? null : result.winner ?? null,
      winnerAgentId:
        result.winner === "p1"
          ? agent1Db.id
          : result.winner === "p2"
          ? agent2Db.id
          : null,
      turnCount: result.turns,
      completedAt: new Date(),
    },
  });

  console.log(`\n🏆 Battle Complete!`);
  if (result.error) {
    console.log(`   ❌ Error: ${result.error}`);
  } else {
    const winnerName =
      result.winner === "p1"
        ? agent1Db.name
        : result.winner === "p2"
        ? agent2Db.name
        : result.winner === "draw"
        ? "Draw"
        : "Unknown";
    console.log(`   Winner: ${winnerName} (${result.winner ?? "none"})`);
    console.log(`   Turns: ${result.turns}`);
    console.log(`   Log lines: ${result.log.length}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
