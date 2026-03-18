import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { ensureServerEnvLoaded } from "../../shared/src/server-env";
import { validateTeam } from "../../sim/src/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));

ensureServerEnvLoaded();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured. Add it to the repo-root .env.");
}

const prisma = new PrismaClient();

async function ensureBaselineAgent(name: string, provider: "random" | "heuristic") {
  const existing = await prisma.agent.findFirst({
    where: { name, provider, modelId: null },
  });

  if (existing) {
    return existing;
  }

  return prisma.agent.create({
    data: { name, provider },
  });
}

async function upsertTeam(name: string, formatId: string, importable: string) {
  const validation = validateTeam(importable, formatId);
  const existing = await prisma.team.findFirst({
    where: { name, formatId },
  });

  if (existing) {
    return prisma.team.update({
      where: { id: existing.id },
      data: {
        importable,
        validationStatus: validation.valid ? "valid" : "invalid",
        validationErrors: validation.valid ? null : validation.errors.join("\n"),
      },
    });
  }

  return prisma.team.create({
    data: {
      name,
      formatId,
      importable,
      validationStatus: validation.valid ? "valid" : "invalid",
      validationErrors: validation.valid ? null : validation.errors.join("\n"),
    },
  });
}

async function main() {
  const defaultTeams = [
    {
      name: "Kingambit Balance",
      formatId: "gen9ou",
      path: join(__dirname, "../../../data/sample-teams/team3.txt"),
    },
    {
      name: "Gliscor Spikes",
      formatId: "gen9ou",
      path: join(__dirname, "../../../data/sample-teams/team4.txt"),
    },
    {
      name: "Landorus Balance",
      formatId: "gen9vgc2024regg",
      path: join(__dirname, "../../../data/sample-teams/team1.txt"),
    },
    {
      name: "Calyrex Shadow Mode",
      formatId: "gen9vgc2024regg",
      path: join(__dirname, "../../../data/sample-teams/team2.txt"),
    },
  ] as const;

  if (defaultTeams.some((team) => !existsSync(team.path))) {
    throw new Error("Sample teams are missing from data/sample-teams");
  }

  const randomAgent = await ensureBaselineAgent("Random Baseline", "random");
  const heuristicAgent = await ensureBaselineAgent("Heuristic Baseline", "heuristic");
  const seededTeams = await Promise.all(
    defaultTeams.map((team) =>
      upsertTeam(team.name, team.formatId, readFileSync(team.path, "utf8"))
    )
  );

  console.log("Seeded baseline data:");
  console.log(`- Agent: ${randomAgent.name}`);
  console.log(`- Agent: ${heuristicAgent.name}`);
  for (const team of seededTeams) {
    console.log(`- Team: ${team.name} (${team.validationStatus})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
