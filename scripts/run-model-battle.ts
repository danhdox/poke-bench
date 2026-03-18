import { existsSync, readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { ensureServerEnvLoaded } from "../packages/shared/src/server-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultTeam1 = join(repoRoot, "data/sample-teams/team1.txt");
const defaultTeam2 = join(repoRoot, "data/sample-teams/team2.txt");
const defaultFormat = "gen9vgc2024regg";

type Provider = "openai" | "anthropic" | "random" | "heuristic";

type CliOptions = {
  provider1: Provider;
  provider2: Provider;
  model1?: string;
  model2?: string;
  name1?: string;
  name2?: string;
  team1: string;
  team2: string;
  formatId: string;
  maxTurns: number;
};

function printUsage(error?: string): never {
  if (error) {
    console.error(`Error: ${error}\n`);
  }
  console.error(`Usage:
  pnpm battle:models --provider1 openai --model1 <openai-model> --provider2 anthropic --model2 <anthropic-model>

Options:
  --provider1 <openai|anthropic|random|heuristic>
  --provider2 <openai|anthropic|random|heuristic>
  --model1 <model-id>
  --model2 <model-id>
  --name1 <display-name>
  --name2 <display-name>
  --team1 <path>           default: data/sample-teams/team1.txt
  --team2 <path>           default: data/sample-teams/team2.txt
  --format <format-id>     default: ${defaultFormat}
  --max-turns <number>     default: 120
`);
  process.exit(error ? 1 : 0);
}

function normalizeProvider(value?: string): Provider {
  if (
    value === "openai" ||
    value === "anthropic" ||
    value === "random" ||
    value === "heuristic"
  ) {
    return value;
  }
  printUsage(`Unsupported provider "${value ?? ""}"`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
  }

  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || !value) {
      printUsage("Arguments must be provided as --key value pairs");
    }
    args.set(key.slice(2), value);
  }

  const provider1 = normalizeProvider(args.get("provider1"));
  const provider2 = normalizeProvider(args.get("provider2"));
  const model1 = args.get("model1");
  const model2 = args.get("model2");

  if ((provider1 === "openai" || provider1 === "anthropic") && !model1) {
    printUsage(`provider1=${provider1} requires --model1`);
  }
  if ((provider2 === "openai" || provider2 === "anthropic") && !model2) {
    printUsage(`provider2=${provider2} requires --model2`);
  }

  return {
    provider1,
    provider2,
    model1,
    model2,
    name1: args.get("name1"),
    name2: args.get("name2"),
    team1: resolve(repoRoot, args.get("team1") ?? defaultTeam1),
    team2: resolve(repoRoot, args.get("team2") ?? defaultTeam2),
    formatId: args.get("format") ?? defaultFormat,
    maxTurns: Number.parseInt(args.get("max-turns") ?? "120", 10),
  };
}

function ensureFile(path: string) {
  if (!existsSync(path)) {
    printUsage(`File not found: ${path}`);
  }
}

function teamNameFromPath(path: string) {
  return basename(path).replace(/\.[^.]+$/, "");
}

async function main() {
  ensureServerEnvLoaded();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Add it to the repo-root .env.");
  }

  const options = parseArgs(process.argv.slice(2));
  ensureFile(options.team1);
  ensureFile(options.team2);

  const team1Importable = readFileSync(options.team1, "utf-8");
  const team2Importable = readFileSync(options.team2, "utf-8");

  const [{ prisma }, { runBattleNow }] = await Promise.all([
    import("../packages/db/src/index.ts"),
    import("../apps/web/lib/jobs.ts"),
  ]);

  const agent1 = await prisma.agent.create({
    data: {
      name: options.name1 ?? `${options.provider1}:${options.model1 ?? "baseline"}`,
      provider: options.provider1,
      modelId: options.model1 ?? null,
      temperature: 0.2,
      maxTokens: 250,
    },
  });
  const agent2 = await prisma.agent.create({
    data: {
      name: options.name2 ?? `${options.provider2}:${options.model2 ?? "baseline"}`,
      provider: options.provider2,
      modelId: options.model2 ?? null,
      temperature: 0.2,
      maxTokens: 250,
    },
  });

  const team1 = await prisma.team.create({
    data: {
      name: teamNameFromPath(options.team1),
      formatId: options.formatId,
      importable: team1Importable,
      validationStatus: "valid",
    },
  });
  const team2 = await prisma.team.create({
    data: {
      name: teamNameFromPath(options.team2),
      formatId: options.formatId,
      importable: team2Importable,
      validationStatus: "valid",
    },
  });

  const battle = await prisma.battle.create({
    data: {
      status: "pending",
      formatId: options.formatId,
      agent1Id: agent1.id,
      agent2Id: agent2.id,
      team1Id: team1.id,
      team2Id: team2.id,
      configJson: JSON.stringify({
        maxTurns: options.maxTurns,
        source: "cli-model-battle",
      }),
    },
  });

  console.log(`Starting persisted battle ${battle.id}`);
  console.log(`  P1: ${agent1.name}`);
  console.log(`  P2: ${agent2.name}`);
  console.log(`  Format: ${options.formatId}`);

  await runBattleNow(battle.id);

  const completed = await prisma.battle.findUnique({
    where: { id: battle.id },
    include: {
      turns: {
        orderBy: [{ turnNumber: "asc" }, { id: "asc" }],
      },
      agent1: true,
      agent2: true,
    },
  });

  if (!completed) {
    throw new Error(`Battle ${battle.id} disappeared after execution`);
  }

  const summary = JSON.parse(completed.summaryJson || "{}") as {
    error?: string;
    log?: string[];
  };

  console.log(`Status: ${completed.status}`);
  console.log(`Winner side: ${completed.winnerSide ?? "none"}`);
  console.log(`Turns: ${completed.turnCount}`);
  console.log(`Recorded decisions: ${completed.turns.length}`);
  if (summary.error) {
    console.log(`Error: ${summary.error}`);
  }
  console.log(`Battle page: /battles/${completed.id}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
