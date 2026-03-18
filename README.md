# poke-bench

`poke-bench` is a TypeScript monorepo for benchmarking AI agents as Pokemon trainers in VGC-style battles.

The core rule of the project is simple: the battle simulator owns the game logic, and the model only chooses from legal actions. This keeps comparisons fair, reproducible, and useful for debugging.

## What the project is aiming to become

The long-term product is a web app for running and inspecting AI-vs-AI Pokemon battles with:

- provider-backed agents such as OpenAI and Anthropic
- baseline bots such as random and heuristic policies
- Showdown-format team import and validation
- single battles, best-of-Ns, and tournament runs
- persisted turn logs, decisions, outcomes, latency, and cost metrics
- local Dex-style lookup pages for Pokemon, moves, items, and abilities

The intended audience is developers, researchers, and hobbyists who want to compare models as battle agents without reimplementing Pokemon mechanics.

## Current status

This repo is now at a local MVP stage. Implemented today:

- a Next.js app for dashboard, agents, teams, battle creation, battle detail, runs, Dex, and leaderboard pages
- JSON API routes for agents, teams, battles, runs, and Dex lookups
- a Prisma schema and Postgres-backed persistence layer for agents, teams, battles, turns, and tournament runs
- a Showdown-backed simulator adapter built on `@pkmn/sim`
- legal action generation for VGC-style doubles, including team preview permutations, switch choices, and tera choices
- `RandomAgent`, `HeuristicAgent`, `OpenAIAgent`, and `AnthropicAgent` adapters
- in-process battle and round-robin run execution with persisted logs, retry-safe model decisions, and summary metrics
- turn-level token usage persistence for provider-backed decisions
- sample VGC teams, baseline agents, and a seed script for local setup

Still intentionally lightweight:

- no human-vs-AI play yet
- no external worker/Redis queue yet
- no provider price table yet, so estimated USD cost is still left blank

## Product principles

- The simulator is authoritative for rules and battle state.
- Agents only receive allowed public information plus their own side context.
- Legal actions are computed server-side before any agent decision.
- Invalid model output must never corrupt battle state.
- Battles should be inspectable through persisted logs and structured turn records.

## Workspace layout

```text
.
├── apps/web/               # Next.js UI + API routes
├── data/sample-teams/      # Showdown importable sample teams
├── packages/agents/        # Baseline + provider-backed agent implementations
├── packages/db/            # Prisma schema and database client
├── packages/dex/           # Dex and format lookup helpers
├── packages/shared/        # Shared types and Zod schemas
├── packages/sim/           # Battle runner, validation, log parsing
├── packages/tournament/    # Scheduling + summary aggregation
└── scripts/demo-battle.ts  # End-to-end demo battle that persists results
```

## Implemented packages

### `@poke-bench/shared`

Shared battle, agent, and observation types. This package defines the provider-agnostic contract used between the simulator and agent implementations.

### `@poke-bench/agents`

Agents available today:

- `RandomAgent`: samples from the legal action list
- `HeuristicAgent`: prefers higher-power move labels using a simple ruleset
- `OpenAIAgent`: provider-backed JSON decision adapter
- `AnthropicAgent`: provider-backed JSON decision adapter

### `@poke-bench/sim`

Battle integration and utilities:

- `runBattle(...)` for headless simulator execution
- `validateTeam(...)` for Showdown-format team validation
- `parseBattleLog(...)` for a basic structured log view
- legal action mapping for team preview, moves, switches, and doubles combinations

### `@poke-bench/dex`

Local Dex and format helpers backed by the simulator data layer.

### `@poke-bench/tournament`

Round-robin scheduling and run summary aggregation.

### `@poke-bench/db`

Prisma models currently cover:

- `Agent`
- `Team`
- `Battle`
- `BattleTurn`
- `TournamentRun`
- `TournamentParticipant`
- `TournamentBattle`

## Quick start

### Prerequisites

- Node.js 22+
- `pnpm`

### Install

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### Run the app

```bash
pnpm dev
```

The web MVP runs at `http://localhost:3000` and supports:

- creating/editing agents
- importing and validating teams
- starting a battle and polling live progress
- starting a round robin run and polling standings
- browsing local Dex data
- viewing leaderboard stats from completed battles

### Run the demo battle

```bash
pnpm demo
```

The demo does the following:

1. loads the two sample teams from `data/sample-teams`
2. creates two random agents
3. starts a doubles-format battle in the Showdown simulator
4. persists the battle record and turn records to the configured Postgres database
5. prints the winner and turn count

Current demo format:

- `gen9vgc2024regg`

### Run a persisted model battle

Put provider keys in the repo-root `.env`, run `pnpm db:seed`, then start the battle from `/battles/new` using the built-in supported-model picker.

If you want the CLI path instead, run:

```bash
pnpm battle:models \
  --provider1 openai \
  --model1 your-openai-model-id \
  --provider2 anthropic \
  --model2 your-anthropic-model-id
```

What this command does:

1. creates two persisted agents from the CLI args
2. creates two persisted teams from the sample importables unless you override them
3. runs the battle through the same server-side simulator/job path used by the web app
4. stores battle turns, raw logs, public reasoning, retries, and token usage in Postgres
5. prints the resulting battle ID so you can inspect `/battles/[id]`

The CLI still needs explicit `--model1` and `--model2`, but the normal web flow no longer depends on model-id env vars.

## Sample data

The repo includes two sample Showdown teams:

- `data/sample-teams/team1.txt`: Landorus / Urshifu / Flutter Mane / Iron Hands / Rillaboom / Incineroar
- `data/sample-teams/team2.txt`: Calyrex-Shadow / Incineroar / Amoonguss / Urshifu / Thundurus / Landorus

These exist so the simulator harness can be exercised locally before the web UI lands.

## Environment

Current env file:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

OpenAI and Anthropic agents are optional. Baseline agents work without provider keys.

## Commands

```bash
pnpm install        # install workspace dependencies
pnpm db:generate    # generate Prisma client
pnpm db:push        # sync the Postgres schema
pnpm db:seed        # seed baseline agents + sample teams
pnpm dev            # run the Next.js app
pnpm demo           # run a persisted random-vs-random battle
pnpm battle:models  # run a persisted provider-backed or baseline battle from the CLI
pnpm build          # workspace build entrypoint
```

## Architecture in one pass

The intended server-side battle loop is:

1. create a battle record
2. initialize the simulator with format + teams
3. wait for a decision request from the simulator
4. compute the legal action list for the side to move
5. call the agent with the legal action set and public observation
6. validate and submit the chosen action to the simulator
7. persist turn data, logs, and final outcome

That separation is the main design constraint for the whole project. The UI should eventually render persisted state, not own the live battle state itself.

## Roadmap

The next high-value improvements are:

1. add a model pricing table so token usage becomes actual estimated USD cost
2. enrich the public observation further with more battle-state summaries and match history
3. add richer tournament modes such as best-of-N and mirror controls in the UI
4. move background execution to a dedicated worker/queue when needed

## Troubleshooting

### `esbuild` platform mismatch

If the repo was copied across machines or containers and `pnpm demo` fails with an `esbuild` platform error, rerun:

```bash
pnpm install
```

### Prisma client not generated

If the demo fails because Prisma client types are missing, run:

```bash
pnpm db:generate
```

## Near-term next step

The next meaningful milestone is to improve the quality of the model-facing observation and prompt loop so provider-backed agents have stronger battle context while preserving fairness and inspectability.
