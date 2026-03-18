import type {
  ActivePokemon,
  BenchPokemon,
  LegalAction,
  PublicBattleObservation,
  RequestType,
} from "@poke-bench/shared";
import { BattleStreams, Dex, Teams } from "@pkmn/sim";
import { parseBattleLog } from "./logParser";

export interface BattleResult {
  winner: "p1" | "p2" | "draw" | null;
  turns: number;
  log: string[];
  error?: string;
}

export interface ChoiceRequestContext {
  side: "p1" | "p2";
  request: any;
  requestType: RequestType;
  legalChoices: string[];
  legalActions: LegalAction[];
  observation: PublicBattleObservation;
  turn: number;
  recentLog: string[];
}

export type ChoiceCallback = (context: ChoiceRequestContext) => Promise<string>;

const SINGLE_TARGET_TYPES = new Set(["normal", "any", "adjacentFoe"]);
const ALLY_TARGET_TYPES = new Set(["adjacentAlly", "adjacentAllyOrSelf"]);
const TERRAIN_EFFECTS = new Set([
  "Electric Terrain",
  "Grassy Terrain",
  "Misty Terrain",
  "Psychic Terrain",
]);
const ROOM_EFFECTS = new Set(["Trick Room", "Magic Room", "Wonder Room", "Gravity"]);

type PublicMonState = {
  key: string;
  side: "p1" | "p2";
  species: string;
  hpPercent: number;
  status?: string;
  fainted: boolean;
  active: boolean;
  boosts: Record<string, number>;
  volatiles: Set<string>;
  knownAbility?: string;
  knownItem?: string;
  knownMoves: Set<string>;
  isTerastallized: boolean;
  teraType?: string;
  types: string[];
};

type PublicBattleState = {
  weather?: string;
  terrain?: string;
  roomEffects: Set<string>;
  sideConditions: Record<"p1" | "p2", Set<string>>;
  activeSlots: Record<"p1" | "p2", Array<string | null>>;
  mons: Map<string, PublicMonState>;
  aliases: Map<string, string>;
};

function getSpeciesName(details?: string) {
  return details?.split(",")[0]?.trim() || "Unknown";
}

function getSpeciesTypes(species: string, terastallized = false, teraType?: string) {
  if (terastallized && teraType && teraType !== "Stellar") {
    return [teraType];
  }
  const dexSpecies = Dex.species.get(species);
  return dexSpecies.exists ? [...dexSpecies.types] : [];
}

function getMoveName(moveId: string) {
  const move = Dex.moves.get(moveId);
  return move.exists ? move.name : moveId;
}

function getMonKey(side: "p1" | "p2", species: string) {
  return `${side}|${species}`;
}

function getSideFromIdent(ident?: string): "p1" | "p2" | null {
  if (!ident) return null;
  if (ident.startsWith("p1")) return "p1";
  if (ident.startsWith("p2")) return "p2";
  return null;
}

function getSlotIndex(ident?: string) {
  if (!ident) return null;
  const match = ident.match(/^p[12]([a-f]):/);
  if (!match?.[1]) return null;
  return match[1].charCodeAt(0) - 97;
}

function normalizeEffectName(raw?: string) {
  return raw
    ?.replace(/^\[from\]\s*/, "")
    .replace(/^move:\s*/, "")
    .replace(/^ability:\s*/, "")
    .trim();
}

function buildMoveChoice(
  slot: number,
  move: any,
  activeCount: number,
  slotIndex: number,
  terastallize = false
): string {
  let choice = `move ${slot}`;
  if (terastallize) {
    choice += " terastallize";
  }
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

function permutations(values: number[], count: number): number[][] {
  if (count === 0) return [[]];
  const result: number[][] = [];
  for (let i = 0; i < values.length; i++) {
    const current = values[i]!;
    const rest = values.filter((_, index) => index !== i);
    for (const tail of permutations(rest, count - 1)) {
      result.push([current, ...tail]);
    }
  }
  return result;
}

export function getRequestType(request: any): RequestType {
  if (request?.teamPreview) return "teamPreview";
  if (request?.forceSwitch) return "switch";
  return "move";
}

export function getLegalChoices(request: any): string[] {
  if (!request || request.wait) return [];

  if (request.teamPreview) {
    const size = request.side?.pokemon?.length ?? 6;
    const count = Math.min(size, request.maxChosenTeamSize ?? 4);
    return permutations(
      Array.from({ length: size }, (_, i) => i + 1),
      count
    ).map((order) => `team ${order.join("")}`);
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
    const switchChoices = pokemon
      .map((mon, index) => ({ mon, index: index + 1 }))
      .filter(({ mon }) => isAvailable(mon))
      .map(({ index }) => `switch ${index}`);

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
            choices.push(buildMoveChoice(i + 1, move, activeArr.length, slotIndex));
            if (active?.canTerastallize) {
              choices.push(
                buildMoveChoice(i + 1, move, activeArr.length, slotIndex, true)
              );
            }
          }
        }
      }
      choices.push(...switchChoices);
      if (choices.length === 0) choices.push("move 1");
      perSlot.push(choices);
    }

    if (perSlot.length === 2) {
      const combos: string[] = [];
      for (const m1 of perSlot[0]!) {
        for (const m2 of perSlot[1]!) {
          if (
            m1.startsWith("switch") &&
            m2.startsWith("switch") &&
            m1 === m2
          ) {
            continue;
          }
          if (
            Number(m1.includes("terastallize")) + Number(m2.includes("terastallize")) >
            1
          ) {
            continue;
          }
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

function parseChoiceSegments(choice: string): string[] {
  return choice.split(",").map((part) => part.trim());
}

function extractChoiceTags(segment: string, request: any, slotIndex: number): string[] {
  if (segment === "pass") return ["pass"];
  if (segment.startsWith("switch ")) return ["switch"];
  if (!segment.startsWith("move ")) return [];

  const tags = ["move"];
  if (segment.includes("terastallize")) tags.push("tera");
  const parts = segment.split(" ");
  const moveIndex = Number.parseInt(parts[1] ?? "1", 10) - 1;
  const move = request.active?.[slotIndex]?.moves?.[moveIndex];
  const moveId = typeof move?.id === "string" ? move.id : "";
  if (moveId === "protect") tags.push("protect");
  if (move?.target === "allAdjacentFoes" || move?.target === "allAdjacent") {
    tags.push("spread");
  }
  return tags;
}

function formatChoiceLabel(choice: string, request: any, requestType: RequestType): string {
  if (requestType === "teamPreview" && choice.startsWith("team ")) {
    const order = choice.slice(5).split("").map((value) => Number.parseInt(value, 10));
    const names = order
      .map((index) => request.side?.pokemon?.[index - 1]?.details?.split(",")[0])
      .filter(Boolean);
    return `Lead order: ${names.join(" / ")}`;
  }

  const pokemon = request.side?.pokemon ?? [];
  const active = request.active ?? [];

  const labels = parseChoiceSegments(choice).map((segment, slotIndex) => {
    if (segment === "pass") {
      return "Pass";
    }

    if (segment.startsWith("switch ")) {
      const targetIndex = Number.parseInt(segment.slice(7), 10);
      const targetName = pokemon[targetIndex - 1]?.details?.split(",")[0] ?? `Slot ${targetIndex}`;
      return `Switch slot ${slotIndex + 1} to ${targetName}`;
    }

    if (segment.startsWith("move ")) {
      const parts = segment.split(" ");
      const moveIndex = Number.parseInt(parts[1] ?? "1", 10) - 1;
      const move = active[slotIndex]?.moves?.[moveIndex];
      const target = parts.at(-1)?.match(/^-?[1-3]$/) ? parts.at(-1) : undefined;
      const teraLabel = segment.includes("terastallize") ? " with Tera" : "";
      const targetLabel = target ? ` (target ${target})` : "";
      return `Use ${move?.move ?? `Move ${moveIndex + 1}`}${teraLabel}${targetLabel}`;
    }

    return segment;
  });

  return labels.join(" + ");
}

export function toLegalActions(
  request: any,
  legalChoices: string[],
  requestType: RequestType
): LegalAction[] {
  return legalChoices.map((choice) => {
    const segments = parseChoiceSegments(choice);
    return {
      id: choice,
      label: formatChoiceLabel(choice, request, requestType),
      kind:
        requestType === "teamPreview"
          ? "teamPreview"
          : segments.every((segment) => segment === "pass" || segment.startsWith("switch "))
          ? "switch"
          : "move",
      tags: segments.flatMap((segment, slotIndex) =>
        extractChoiceTags(segment, request, slotIndex)
      ),
    };
  });
}

function parseCondition(condition?: string) {
  if (!condition) return { hpPercent: 100, fainted: false, status: undefined };
  if (condition.endsWith(" fnt")) {
    return { hpPercent: 0, fainted: true, status: "fnt" };
  }

  const [hpPart, status] = condition.split(" ");
  const [current, total] = (hpPart ?? "").split("/");
  const hpPercent =
    current && total && Number(total) > 0
      ? Math.max(0, Math.round((Number(current) / Number(total)) * 100))
      : 100;
  return {
    hpPercent,
    fainted: false,
    status,
  };
}

function summarizePokemon(mon: any) {
  const condition = parseCondition(mon?.condition);
  const species = getSpeciesName(mon?.details ?? mon?.ident);
  const teraType = typeof mon?.teraType === "string" ? mon.teraType : undefined;
  return {
    species,
    hpPercent: condition.hpPercent,
    status: condition.status,
    boosts: {},
    types: getSpeciesTypes(species, Boolean(mon?.terastallized), teraType),
    volatiles: [],
    isTerastallized: Boolean(mon?.terastallized),
    teraType,
    knownAbility: mon?.ability ?? mon?.baseAbility,
    knownItem: mon?.item,
    knownMoves: Array.isArray(mon?.moves) ? mon.moves.map((move: string) => getMoveName(move)) : [],
  };
}

function createPublicBattleState(): PublicBattleState {
  return {
    roomEffects: new Set(),
    sideConditions: {
      p1: new Set(),
      p2: new Set(),
    },
    activeSlots: {
      p1: [],
      p2: [],
    },
    mons: new Map(),
    aliases: new Map(),
  };
}

function getOrCreatePublicMon(
  state: PublicBattleState,
  side: "p1" | "p2",
  species: string
) {
  const key = getMonKey(side, species);
  if (!state.mons.has(key)) {
    state.mons.set(key, {
      key,
      side,
      species,
      hpPercent: 100,
      fainted: false,
      active: false,
      boosts: {},
      volatiles: new Set(),
      knownMoves: new Set(),
      isTerastallized: false,
      types: getSpeciesTypes(species),
    });
  }
  return state.mons.get(key)!;
}

function registerAlias(state: PublicBattleState, alias: string, key: string) {
  state.aliases.set(alias, key);
  const slotlessAlias = alias.replace(/^(p[12])[a-f]:/, "$1:");
  state.aliases.set(slotlessAlias, key);
}

function resolvePublicMon(state: PublicBattleState, ident?: string) {
  if (!ident) return null;
  const key = state.aliases.get(ident) ?? state.aliases.get(ident.replace(/^(p[12])[a-f]:/, "$1:"));
  return key ? state.mons.get(key) ?? null : null;
}

function updateCondition(mon: PublicMonState, condition?: string) {
  const parsed = parseCondition(condition);
  mon.hpPercent = parsed.hpPercent;
  mon.fainted = parsed.fainted;
  mon.status = parsed.status;
  if (parsed.fainted) mon.active = false;
}

function applySwitch(
  state: PublicBattleState,
  ident: string,
  details: string,
  condition: string
) {
  const side = getSideFromIdent(ident);
  if (!side) return;
  const species = getSpeciesName(details);
  const mon = getOrCreatePublicMon(state, side, species);
  registerAlias(state, ident, mon.key);
  updateCondition(mon, condition);
  mon.active = !mon.fainted;
  const slotIndex = getSlotIndex(ident);
  if (slotIndex !== null) {
    const previousKey = state.activeSlots[side][slotIndex];
    if (previousKey && previousKey !== mon.key) {
      const previous = state.mons.get(previousKey);
      if (previous) previous.active = false;
    }
    state.activeSlots[side][slotIndex] = mon.key;
  }
}

function buildPublicBattleState(log: string[]) {
  const state = createPublicBattleState();

  for (const line of log) {
    if (!line.startsWith("|")) continue;
    const parts = line.split("|");
    const type = parts[1];

    switch (type) {
      case "poke": {
        const side = parts[2] === "p1" || parts[2] === "p2" ? parts[2] : null;
        if (!side) break;
        const species = getSpeciesName(parts[3]);
        const mon = getOrCreatePublicMon(state, side, species);
        registerAlias(state, `${side}: ${species}`, mon.key);
        break;
      }
      case "switch":
      case "drag":
      case "replace":
        if (parts[2] && parts[3] && parts[4]) {
          applySwitch(state, parts[2], parts[3], parts[4]);
        }
        break;
      case "-damage":
      case "-heal": {
        const mon = resolvePublicMon(state, parts[2]);
        if (mon) updateCondition(mon, parts[3]);
        break;
      }
      case "faint": {
        const mon = resolvePublicMon(state, parts[2]);
        if (!mon) break;
        mon.fainted = true;
        mon.hpPercent = 0;
        mon.status = "fnt";
        mon.active = false;
        const side = getSideFromIdent(parts[2]);
        const slotIndex = getSlotIndex(parts[2]);
        if (side && slotIndex !== null) {
          state.activeSlots[side][slotIndex] = null;
        }
        break;
      }
      case "-boost":
      case "-unboost": {
        const mon = resolvePublicMon(state, parts[2]);
        const stat = parts[3];
        const amount = Number.parseInt(parts[4] ?? "0", 10);
        if (mon && stat) {
          mon.boosts[stat] = (mon.boosts[stat] ?? 0) + (type === "-boost" ? amount : -amount);
        }
        break;
      }
      case "-clearboost": {
        const mon = resolvePublicMon(state, parts[2]);
        if (mon) mon.boosts = {};
        break;
      }
      case "-clearallboost":
        for (const mon of state.mons.values()) {
          mon.boosts = {};
        }
        break;
      case "-start": {
        const mon = resolvePublicMon(state, parts[2]);
        const effect = normalizeEffectName(parts[3]);
        if (mon && effect) mon.volatiles.add(effect);
        break;
      }
      case "-end": {
        const mon = resolvePublicMon(state, parts[2]);
        const effect = normalizeEffectName(parts[3]);
        if (mon && effect) mon.volatiles.delete(effect);
        break;
      }
      case "-ability": {
        const mon = resolvePublicMon(state, parts[2]);
        if (mon && parts[3]) mon.knownAbility = parts[3];
        break;
      }
      case "-item":
      case "-enditem": {
        const mon = resolvePublicMon(state, parts[2]);
        if (mon && parts[3]) mon.knownItem = parts[3];
        break;
      }
      case "move": {
        const mon = resolvePublicMon(state, parts[2]);
        if (mon && parts[3]) mon.knownMoves.add(parts[3]);
        break;
      }
      case "-terastallize": {
        const mon = resolvePublicMon(state, parts[2]);
        if (!mon) break;
        mon.isTerastallized = true;
        mon.teraType = parts[3];
        mon.types = getSpeciesTypes(mon.species, true, mon.teraType);
        break;
      }
      case "-weather":
        state.weather = parts[2] === "none" ? undefined : parts[2];
        break;
      case "-fieldstart": {
        const effect = normalizeEffectName(parts[2]);
        if (!effect) break;
        if (TERRAIN_EFFECTS.has(effect)) {
          state.terrain = effect;
        } else if (ROOM_EFFECTS.has(effect)) {
          state.roomEffects.add(effect);
        }
        break;
      }
      case "-fieldend": {
        const effect = normalizeEffectName(parts[2]);
        if (!effect) break;
        if (state.terrain === effect) {
          state.terrain = undefined;
        }
        state.roomEffects.delete(effect);
        break;
      }
      case "-sidestart": {
        const side = getSideFromIdent(parts[2]);
        const effect = normalizeEffectName(parts[3]);
        if (side && effect) state.sideConditions[side].add(effect);
        break;
      }
      case "-sideend": {
        const side = getSideFromIdent(parts[2]);
        const effect = normalizeEffectName(parts[3]);
        if (side && effect) state.sideConditions[side].delete(effect);
        break;
      }
      default:
        break;
    }
  }

  return state;
}

function toActivePokemon(mon: PublicMonState): ActivePokemon {
  return {
    species: mon.species,
    hpPercent: mon.hpPercent,
    status: mon.status,
    boosts: mon.boosts,
    types: mon.types,
    volatiles: Array.from(mon.volatiles),
    isTerastallized: mon.isTerastallized,
    teraType: mon.teraType,
    knownAbility: mon.knownAbility,
    knownItem: mon.knownItem,
    knownMoves: Array.from(mon.knownMoves),
  };
}

function toBenchPokemon(mon: PublicMonState): BenchPokemon {
  return {
    species: mon.species,
    hpPercent: mon.hpPercent,
    status: mon.status,
    fainted: mon.fainted,
    knownAbility: mon.knownAbility,
    knownItem: mon.knownItem,
  };
}

function summarizeOwnPokemon(
  mon: any,
  state: PublicBattleState
): ActivePokemon {
  const summary = summarizePokemon(mon);
  const publicMon = resolvePublicMon(state, mon?.ident ?? `${getSideFromIdent(mon?.ident) ?? "p1"}: ${summary.species}`);
  return {
    ...summary,
    boosts: publicMon?.boosts ?? {},
    volatiles: publicMon ? Array.from(publicMon.volatiles) : [],
    knownAbility: summary.knownAbility ?? publicMon?.knownAbility,
    knownItem: summary.knownItem ?? publicMon?.knownItem,
    knownMoves: summary.knownMoves,
    types:
      publicMon?.types.length
        ? publicMon.types
        : getSpeciesTypes(summary.species, summary.isTerastallized, summary.teraType),
  };
}

function getLastCompletedTurnSummary(log: string[], turn: number) {
  const parsed = parseBattleLog(log);
  return [...parsed.turns]
    .reverse()
    .find(
      (entry) =>
        entry.turn < turn &&
        (entry.moves.length > 0 || entry.fainted.length > 0 || Boolean(entry.weather))
    );
}

export function buildObservationFromRequest(
  battleId: string,
  formatId: string,
  side: "p1" | "p2",
  turn: number,
  request: any,
  legalActions: LegalAction[],
  log: string[]
): PublicBattleObservation {
  const publicState = buildPublicBattleState(log);
  const opponentSide = side === "p1" ? "p2" : "p1";
  const ownPokemon: any[] = request?.side?.pokemon ?? [];
  const ownActive = ownPokemon
    .filter((mon) => mon?.active)
    .map((mon) => summarizeOwnPokemon(mon, publicState));
  const ownBench = ownPokemon
    .filter((mon) => !mon?.active)
    .map((mon) => {
      const summary = summarizeOwnPokemon(mon, publicState);
      return {
        species: summary.species,
        hpPercent: summary.hpPercent,
        status: summary.status,
        fainted: summary.hpPercent === 0,
        knownAbility: summary.knownAbility,
        knownItem: summary.knownItem,
      };
    });
  const opponentMons = Array.from(publicState.mons.values()).filter(
    (mon) => mon.side === opponentSide
  );
  const opponentActive = publicState.activeSlots[opponentSide]
    .map((key) => (key ? publicState.mons.get(key) ?? null : null))
    .filter((mon): mon is PublicMonState => Boolean(mon))
    .map((mon) => toActivePokemon(mon));
  const opponentRevealed = opponentMons
    .filter((mon) => !mon.active)
    .map((mon) => toBenchPokemon(mon));

  return {
    battleId,
    formatId,
    turn,
    requestType: getRequestType(request),
    side,
    weather: publicState.weather,
    terrain: publicState.terrain,
    roomEffects: Array.from(publicState.roomEffects),
    ownSideConditions: Array.from(publicState.sideConditions[side]),
    opponentSideConditions: Array.from(publicState.sideConditions[opponentSide]),
    ownActive,
    opponentActive,
    ownBench,
    opponentRevealed,
    faintedOwn: ownPokemon
      .filter((mon) => parseCondition(mon?.condition).fainted)
      .map((mon) => getSpeciesName(mon?.details)),
    faintedOpponent: opponentMons.filter((mon) => mon.fainted).map((mon) => mon.species),
    lastTurnSummary: getLastCompletedTurnSummary(log, turn),
    legalActions,
  };
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
  let callbackLogIndex = 0;

  const pendingRequests: Map<"p1" | "p2", any> = new Map();

  async function processRequests() {
    for (const [side, req] of Array.from(pendingRequests.entries())) {
      if (req && !req.wait) {
        const choices = getLegalChoices(req);
        if (choices.length > 0) {
          pendingRequests.delete(side);
          const requestType = getRequestType(req);
          const legalActions = toLegalActions(req, choices, requestType);
          const observation = buildObservationFromRequest(
            "runtime",
            formatId,
            side,
            turns,
            req,
            legalActions,
            log
          );
          const choice = await choiceCallback({
            side,
            request: req,
            requestType,
            legalChoices: choices,
            legalActions,
            observation,
            turn: turns,
            recentLog: log.slice(callbackLogIndex),
          });
          callbackLogIndex = log.length;
          stream.write(`>${side} ${choice}`);
        }
      }
    }
  }

  try {
    while (true) {
      const chunk = await stream.read();
      if (chunk === null) break;
      if (typeof chunk !== "string") continue;
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
