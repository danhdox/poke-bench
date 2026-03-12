import { BattleStreams, Teams } from "@pkmn/sim";

export interface BattleResult {
  winner: "p1" | "p2" | "draw" | null;
  turns: number;
  log: string[];
  error?: string;
}

export type ChoiceCallback = (
  side: "p1" | "p2",
  request: any,
  legalChoices: string[]
) => Promise<string>;

const SINGLE_TARGET_TYPES = new Set(["normal", "any", "adjacentFoe"]);
const ALLY_TARGET_TYPES = new Set(["adjacentAlly", "adjacentAllyOrSelf"]);

function buildMoveChoice(
  slot: number,
  move: any,
  activeCount: number,
  slotIndex: number
): string {
  let choice = `move ${slot}`;
  if (activeCount > 1 && move.target) {
    if (SINGLE_TARGET_TYPES.has(move.target)) {
      choice += " 1";
    } else if (ALLY_TARGET_TYPES.has(move.target)) {
      choice += ` -${(slotIndex ^ 1) + 1}`;
    }
  }
  return choice;
}

function isAvailable(mon: any): boolean {
  if (!mon) return false;
  if (mon.active) return false;
  if (mon.condition?.endsWith(" fnt")) return false;
  return true;
}

function getLegalChoices(request: any): string[] {
  if (!request || request.wait) return [];

  if (request.teamPreview) {
    const count = Math.min(
      request.side?.pokemon?.length ?? 6,
      request.maxChosenTeamSize ?? 4
    );
    const order = Array.from({ length: count }, (_, i) => i + 1).join("");
    return [`team ${order}`];
  }

  if (request.forceSwitch) {
    const forceArr: boolean[] = Array.isArray(request.forceSwitch)
      ? request.forceSwitch
      : [true];
    const pokemon: any[] = request.side?.pokemon ?? [];
    const activeSlots = forceArr.length;
    const chosen: number[] = [];
    const perSlot: string[] = [];

    for (let slot = 0; slot < forceArr.length; slot++) {
      if (!forceArr[slot]) {
        perSlot.push("pass");
        continue;
      }
      let found = "";
      for (let i = activeSlots + 1; i <= pokemon.length; i++) {
        const mon = pokemon[i - 1];
        if (mon && isAvailable(mon) && !chosen.includes(i)) {
          found = `switch ${i}`;
          chosen.push(i);
          break;
        }
      }
      perSlot.push(found || "pass");
    }

    return [perSlot.join(", ")];
  }

  if (request.active) {
    const activeArr = request.active as any[];
    const pokemon: any[] = request.side?.pokemon ?? [];
    const perSlot: string[][] = [];

    for (let slotIndex = 0; slotIndex < activeArr.length; slotIndex++) {
      const active = activeArr[slotIndex];
      const mon = pokemon[slotIndex];

      if (mon?.condition?.endsWith(" fnt") || mon?.commanding) {
        perSlot.push(["pass"]);
        continue;
      }

      const choices: string[] = [];
      if (active?.moves) {
        for (let i = 0; i < active.moves.length; i++) {
          const move = active.moves[i];
          if (move && !move.disabled) {
            choices.push(
              buildMoveChoice(i + 1, move, activeArr.length, slotIndex)
            );
          }
        }
      }
      if (choices.length === 0) choices.push("move 1");
      perSlot.push(choices);
    }

    if (perSlot.length === 2) {
      const combos: string[] = [];
      for (const m1 of perSlot[0]!) {
        for (const m2 of perSlot[1]!) {
          combos.push(`${m1}, ${m2}`);
        }
      }
      return combos.length > 0 ? combos : ["move 1 1, move 1 1"];
    }

    // Singles fallback
    const choices = [...(perSlot[0] ?? ["move 1"])];
    for (let i = 1; i <= pokemon.length; i++) {
      const mon = pokemon[i - 1];
      if (mon && !mon.active && !mon.condition?.endsWith(" fnt")) {
        choices.push(`switch ${i}`);
      }
    }
    return choices.length > 0 ? choices : ["move 1"];
  }

  return ["move 1"];
}

export async function runBattle(
  team1: string,
  team2: string,
  formatId: string,
  choiceCallback: ChoiceCallback,
  maxTurns: number = 200
): Promise<BattleResult> {
  const { BattleStream } = BattleStreams;
  const stream = new BattleStream();

  const teamObj1 = Teams.import(team1);
  const teamObj2 = Teams.import(team2);
  const packed1 = Teams.pack(teamObj1 ?? []);
  const packed2 = Teams.pack(teamObj2 ?? []);

  if (!packed1) {
    return { winner: null, turns: 0, log: [], error: "Failed to pack team1" };
  }
  if (!packed2) {
    return { winner: null, turns: 0, log: [], error: "Failed to pack team2" };
  }

  stream.write(
    `>start {"formatid":"${formatId}","p1":{"name":"Player1","team":"${packed1}"},"p2":{"name":"Player2","team":"${packed2}"}}`
  );

  const log: string[] = [];
  let winner: "p1" | "p2" | "draw" | null = null;
  let turns = 0;

  const pendingRequests: Map<"p1" | "p2", any> = new Map();

  async function processRequests() {
    for (const [side, req] of Array.from(pendingRequests.entries())) {
      if (req && !req.wait) {
        const choices = getLegalChoices(req);
        if (choices.length > 0) {
          pendingRequests.delete(side);
          const choice = await choiceCallback(side, req, choices);
          stream.write(`>${side} ${choice}`);
        }
      }
    }
  }

  try {
    let chunk: string | null;
    while ((chunk = await stream.read()) !== null) {
      const chunkLines = chunk.split("\n");
      const chunkType = chunkLines[0];

      if (chunkType === "update") {
        for (const line of chunkLines.slice(1)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          log.push(trimmed);
          if (trimmed.startsWith("|win|")) {
            const winnerName = trimmed.slice(5).trim();
            winner = winnerName === "Player1" ? "p1" : "p2";
          } else if (trimmed === "|tie" || trimmed.startsWith("|tie|")) {
            winner = "draw";
          } else if (trimmed.startsWith("|turn|")) {
            turns = parseInt(trimmed.slice(6), 10);
          }
        }
      } else if (chunkType === "sideupdate") {
        const sideStr = chunkLines[1];
        const side = sideStr === "p1" || sideStr === "p2" ? sideStr : null;
        if (side) {
          for (let i = 2; i < chunkLines.length; i++) {
            const line = chunkLines[i];
            if (line && line.startsWith("|request|")) {
              const reqJson = line.slice(9);
              if (reqJson && reqJson !== "null") {
                try {
                  const req = JSON.parse(reqJson);
                  pendingRequests.set(side, req);
                } catch {
                  // ignore parse errors
                }
              }
            }
          }
        }
      }

      if (winner !== null) break;
      if (turns >= maxTurns) break;

      await processRequests();
    }
  } catch (err) {
    return {
      winner: null,
      turns,
      log,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return { winner, turns, log };
}
