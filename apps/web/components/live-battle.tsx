"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicBattleObservation } from "@poke-bench/shared";
import { AgentThoughtChat, type ThoughtChatMessage } from "./agent-thought-chat";
import {
  BattleArena,
  type BattleArenaActionEvent,
  type BattleArenaMove,
} from "./battle-arena";
import { usePageScrollLock } from "./use-page-scroll-lock";
import {
  extractTeamPreviewSpecies,
  getPokemonSpriteUrl,
  parseImportableTeam,
  reconcileSpeciesWithPreview,
} from "../lib/pokemon-sprites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LiveBattlePayload = {
  id: string;
  status: string;
  formatId: string;
  winnerSide: string | null;
  turnCount: number;
  config?: {
    maxTurns?: number;
  };
  agent1: { name: string };
  agent2: { name: string };
  team1: { name: string; importable?: string | null };
  team2: { name: string; importable?: string | null };
  summary: {
    log: string[];
    parsedTurns: Array<{
      turn: number;
      lines: string[];
      moves: { pokemon: string; move: string; target?: string }[];
      fainted: string[];
      weather?: string;
    }>;
    error?: string;
  };
  turns: Array<{
    id: string;
    turnNumber: number;
    actingSide: string;
    requestType: string;
    chosenAction: string;
    publicReasoning: string | null;
    latencyMs: number;
    tokenUsageJson: string | null;
    fallbackUsed: boolean;
    observationJson: string;
    legalActionsJson: string;
    logChunk: string | null;
  }>;
};

function parseJsonSafely<T>(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type StoredObservationEnvelope = {
  observation?: PublicBattleObservation;
  request?: StoredBattleRequest;
};

type DexMoveEntry = {
  id: string;
  name: string;
  type: string;
  pp: number;
};

type StoredRequestMove = {
  move?: string;
  id?: string;
  pp?: number;
  maxpp?: number;
  disabled?: boolean;
};

type StoredBattleRequest = {
  active?: Array<{
    moves?: StoredRequestMove[];
  }>;
};

type ResolvedMoveEntry = {
  id: string;
  name: string;
  pp?: number | null;
  maxPp?: number | null;
};

function isPublicBattleObservation(
  value: PublicBattleObservation | StoredObservationEnvelope
): value is PublicBattleObservation {
  return "battleId" in value && "ownActive" in value && "opponentActive" in value;
}

function describeActiveGroup(
  active: Array<{ species: string; hpPercent: number; status?: string }> | undefined
) {
  if (!active || active.length === 0) {
    return {
      activeLabel: "Awaiting lead reveal",
      detail: "No active Pokemon observed yet.",
      hpPercent: null,
      status: null,
    };
  }

  const label = active.map((pokemon) => pokemon.species).join(" / ");
  const averageHp =
    active.reduce((total, pokemon) => total + pokemon.hpPercent, 0) / active.length;
  const status = active.length === 1 ? active[0]?.status ?? null : null;

  return {
    activeLabel: label,
    detail: "",
    hpPercent: averageHp,
    status: averageHp <= 0 ? "fnt" : status,
  };
}

function applyTerminalSideState(
  battle: LiveBattlePayload,
  side: "p1" | "p2",
  state: {
    active: PublicBattleObservation["ownActive"];
    bench: PublicBattleObservation["ownBench"];
  }
) {
  if (battle.status !== "completed" || !battle.winnerSide) {
    return state;
  }

  const losingSide = battle.winnerSide === "p1" ? "p2" : "p1";
  if (side !== losingSide) {
    return state;
  }

  const hasRemainingBench = state.bench.some(
    (pokemon) => !pokemon.fainted && pokemon.hpPercent > 0
  );
  if (hasRemainingBench || state.active.length === 0) {
    return state;
  }

  return {
    active: state.active.map((pokemon) => ({
      ...pokemon,
      hpPercent: 0,
      status: "fnt",
    })),
    bench: state.bench,
  };
}

function normalizeBattlePayload(payload: LiveBattlePayload): LiveBattlePayload {
  return {
    ...payload,
    turns: payload.turns ?? [],
    summary: {
      log: payload.summary?.log ?? [],
      parsedTurns: payload.summary?.parsedTurns ?? [],
      error: payload.summary?.error,
    },
  };
}

function mergeBattlePayload(
  previous: LiveBattlePayload,
  next: LiveBattlePayload
): LiveBattlePayload {
  return normalizeBattlePayload({
    ...next,
    team1: {
      ...next.team1,
      importable: next.team1.importable ?? previous.team1.importable ?? null,
    },
    team2: {
      ...next.team2,
      importable: next.team2.importable ?? previous.team2.importable ?? null,
    },
    turns: next.turns.length > 0 ? next.turns : previous.turns,
    summary:
      next.summary.log.length > 0 || next.summary.parsedTurns.length > 0 || next.summary.error
        ? next.summary
        : previous.summary,
  });
}

function parseObservation(value: string | null | undefined) {
  const parsed = parseJsonSafely<PublicBattleObservation | StoredObservationEnvelope>(value);
  if (!parsed) return null;
  if ("observation" in parsed && parsed.observation) {
    return parsed.observation;
  }
  return isPublicBattleObservation(parsed) ? parsed : null;
}

function parseStoredEnvelope(value: string | null | undefined) {
  const parsed = parseJsonSafely<PublicBattleObservation | StoredObservationEnvelope>(value);
  if (!parsed) return null;
  if ("observation" in parsed || "request" in parsed) {
    return parsed;
  }
  if (isPublicBattleObservation(parsed)) {
    return { observation: parsed };
  }
  return null;
}

function getLatestSideObservation(
  observations: PublicBattleObservation[],
  side: "p1" | "p2"
) {
  const emptyState = {
    active: [] as PublicBattleObservation["ownActive"],
    bench: [] as PublicBattleObservation["ownBench"],
  };
  let latestActive: PublicBattleObservation["ownActive"] | null = null;
  let latestBench: PublicBattleObservation["ownBench"] | null = null;

  for (const observation of [...observations].reverse()) {
    const candidate =
      observation.side === side
        ? {
            active: observation.ownActive,
            bench: observation.ownBench,
          }
        : {
            active: observation.opponentActive,
            bench: observation.opponentRevealed,
          };

    if (latestActive === null && candidate.active.length > 0) {
      latestActive = candidate.active;
    }

    if (latestBench === null && candidate.bench.length > 0) {
      latestBench = candidate.bench;
    }

    if (latestActive && latestBench) {
      break;
    }
  }

  if (latestActive || latestBench) {
    return {
      active: latestActive ?? [],
      bench: latestBench ?? [],
    };
  }

  return emptyState;
}

function buildTeamSprites(
  previewSpecies: string[],
  activePokemon: Array<{ species: string; hpPercent: number }>,
  benchPokemon: Array<{ species: string; hpPercent: number; fainted?: boolean }>,
  perspective: "front" | "back"
) {
  const reconciledActiveSpecies = activePokemon.map((pokemon) =>
    reconcileSpeciesWithPreview(pokemon.species, previewSpecies)
  );
  const slotState = new Map<
    string,
    {
      hpPercent: number;
      fainted: boolean;
    }
  >();

  for (const pokemon of benchPokemon) {
    const species = reconcileSpeciesWithPreview(pokemon.species, previewSpecies);
    slotState.set(species, {
      hpPercent: pokemon.hpPercent,
      fainted: pokemon.fainted ?? pokemon.hpPercent <= 0,
    });
  }

  for (const pokemon of activePokemon) {
    const species = reconcileSpeciesWithPreview(pokemon.species, previewSpecies);
    slotState.set(species, {
      hpPercent: pokemon.hpPercent,
      fainted: pokemon.hpPercent <= 0,
    });
  }

  const orderedSpecies = [
    ...previewSpecies,
    ...reconciledActiveSpecies.filter((species) => !previewSpecies.includes(species)),
  ].slice(0, 6);

  return {
    highlightedSpecies: reconciledActiveSpecies,
    sprites: orderedSpecies.map((species) => ({
      url: getPokemonSpriteUrl(species, perspective),
      alt: species,
      hpPercent: slotState.get(species)?.hpPercent ?? null,
      fainted: slotState.get(species)?.fainted ?? false,
    })),
    activeSprites: reconciledActiveSpecies.map((species) => {
      const matchingPokemon = activePokemon.find(
        (pokemon) => reconcileSpeciesWithPreview(pokemon.species, previewSpecies) === species
      );
      const hpPercent = matchingPokemon?.hpPercent ?? null;

      return {
        url: getPokemonSpriteUrl(species, perspective),
        alt: species,
        hpPercent,
        fainted: hpPercent !== null && hpPercent <= 0,
      };
    }),
  };
}

function toMoveId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseChoiceSegments(choice: string) {
  return choice
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getActiveMoves(activePokemon: Array<{ knownMoves?: string[] }>) {
  const seen = new Set<string>();
  const moves: ResolvedMoveEntry[] = [];

  for (const pokemon of activePokemon) {
    for (const move of pokemon.knownMoves ?? []) {
      const moveId = toMoveId(move);
      if (!move || !moveId || seen.has(moveId)) continue;
      seen.add(moveId);
      moves.push({ id: moveId, name: move });
    }
  }

  return moves;
}

function getRequestMoves(request: StoredBattleRequest | undefined) {
  const seen = new Set<string>();
  const moves: ResolvedMoveEntry[] = [];

  for (const active of request?.active ?? []) {
    for (const move of active.moves ?? []) {
      const moveId = move.id ? toMoveId(move.id) : toMoveId(move.move ?? "");
      const moveName = move.move?.trim();
      if (!moveId || !moveName || seen.has(moveId) || move.disabled) {
        continue;
      }
      seen.add(moveId);
      moves.push({
          id: moveId,
          name: moveName,
          pp: move.pp ?? null,
          maxPp: move.maxpp ?? null,
      });
    }
  }

  return moves;
}

function getLatestSideRequestMoves(
  turns: LiveBattlePayload["turns"],
  side: "p1" | "p2",
  currentActiveSpecies: string[]
) {
  const expected = currentActiveSpecies.map((species) => species.toLowerCase()).join("|");
  if (!expected) {
    return [];
  }

  for (const turn of [...turns].reverse()) {
    if (turn.actingSide !== side) {
      continue;
    }

    const envelope = parseStoredEnvelope(turn.observationJson);
    const observation = envelope?.observation;
    if (!observation || observation.side !== side) {
      continue;
    }

    const observed = observation.ownActive
      .map((pokemon) => pokemon.species.toLowerCase())
      .join("|");
    if (observed !== expected) {
      continue;
    }

    const requestMoves = getRequestMoves(envelope.request);
    if (requestMoves.length > 0) {
      return requestMoves;
    }
  }

  return [];
}

function getLatestSideChosenMoveIds(
  turns: LiveBattlePayload["turns"],
  side: "p1" | "p2",
  currentActiveSpecies: string[]
) {
  const expected = currentActiveSpecies.map((species) => species.toLowerCase()).join("|");
  if (!expected) {
    return [];
  }

  for (const turn of [...turns].reverse()) {
    if (turn.actingSide !== side) {
      continue;
    }

    const envelope = parseStoredEnvelope(turn.observationJson);
    const observation = envelope?.observation;
    if (!observation || observation.side !== side) {
      continue;
    }

    const observed = observation.ownActive
      .map((pokemon) => pokemon.species.toLowerCase())
      .join("|");
    if (observed !== expected) {
      continue;
    }

    const chosenMoveIds = parseChoiceSegments(turn.chosenAction)
      .map((segment, slotIndex) => {
        const match = segment.match(/^move\s+(\d+)/i);
        if (!match?.[1]) {
          return null;
        }

        const moveIndex = Number.parseInt(match[1], 10) - 1;
        if (moveIndex < 0) {
          return null;
        }

        const requestMove = envelope.request?.active?.[slotIndex]?.moves?.[moveIndex];
        const moveId = requestMove?.id ? toMoveId(requestMove.id) : toMoveId(requestMove?.move ?? "");
        return moveId || null;
      })
      .filter((moveId): moveId is string => Boolean(moveId));

    if (chosenMoveIds.length > 0) {
      return Array.from(new Set(chosenMoveIds));
    }
  }

  return [];
}

function getTurnActionEvent(
  turn: LiveBattlePayload["turns"][number] | null,
  moveDexById: Record<string, DexMoveEntry>
): BattleArenaActionEvent | null {
  if (!turn || turn.requestType !== "move") {
    return null;
  }

  const envelope = parseStoredEnvelope(turn.observationJson);
  const firstChoice = parseChoiceSegments(turn.chosenAction)[0];
  if (!firstChoice) {
    return null;
  }

  const match = firstChoice.match(/^move\s+(\d+)(?:\s+terastallize)?(?:\s+(-?\d+))?/i);
  if (!match?.[1]) {
    return null;
  }

  const moveIndex = Number.parseInt(match[1], 10) - 1;
  if (moveIndex < 0) {
    return null;
  }

  const requestMove = envelope?.request?.active?.[0]?.moves?.[moveIndex];
  const moveId = requestMove?.id ? toMoveId(requestMove.id) : toMoveId(requestMove?.move ?? "");
  if (!moveId) {
    return null;
  }

  const move = moveDexById[moveId];

  return {
    key: `${turn.id}:${moveId}`,
    side: turn.actingSide === "p1" ? "p1" : "p2",
    moveId,
    moveName: move?.name ?? requestMove?.move?.trim() ?? moveId,
    moveType: move?.type ?? null,
    targetHint: match[2] ? Number.parseInt(match[2], 10) : null,
  };
}

function isBattleTerminal(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function getBattleOutcome(battle: LiveBattlePayload) {
  if (battle.status === "completed") {
    if (battle.winnerSide === "p1") {
      return {
        title: `${battle.team1.name} wins`,
        subtitle: `${battle.agent1.name} closes the match in ${battle.turnCount} turns.`,
        meta: "Battle complete",
      };
    }

    if (battle.winnerSide === "p2") {
      return {
        title: `${battle.team2.name} wins`,
        subtitle: `${battle.agent2.name} closes the match in ${battle.turnCount} turns.`,
        meta: "Battle complete",
      };
    }

    return {
      title: "Battle complete",
      subtitle: `The battle ended after ${battle.turnCount} turns without a recorded winner.`,
      meta: "Battle complete",
    };
  }

  if (battle.status === "cancelled") {
    return {
      title: "Battle cancelled",
      subtitle: "This match was stopped before a squad could claim the win.",
      meta: "Battle cancelled",
    };
  }

  if (battle.status === "failed") {
    return {
      title: "Battle failed",
      subtitle: battle.summary.error ?? "The match ended because of a runtime issue.",
      meta: "Battle failed",
    };
  }

  return null;
}

function hasMeaningfulBattleChange(
  current: LiveBattlePayload,
  next: LiveBattlePayload
) {
  return (
    current.status !== next.status ||
    current.winnerSide !== next.winnerSide ||
    current.turnCount !== next.turnCount ||
    current.summary.error !== next.summary.error ||
    current.summary.log.length !== next.summary.log.length ||
    current.turns.length !== next.turns.length ||
    current.turns.at(-1)?.id !== next.turns.at(-1)?.id
  );
}

function getPendingThinkingMessage(battle: LiveBattlePayload): ThoughtChatMessage | null {
  if (isBattleTerminal(battle.status)) {
    return null;
  }

  if (battle.turns.length === 0) {
    return {
      id: "system-thinking-start",
      side: "p1",
      speaker: battle.agent1.name,
      content: "Thinking through the opening lead and first-turn plan...",
      meta: "Up next",
      pending: true,
    };
  }

  const lastTurn = battle.turns.at(-1);
  if (!lastTurn) {
    return null;
  }

  const nextSide = lastTurn.actingSide === "p1" ? "p2" : "p1";
  const nextSpeaker = nextSide === "p1" ? battle.agent1.name : battle.agent2.name;
  const nextTurnNumber = lastTurn.actingSide === "p2" ? lastTurn.turnNumber + 1 : lastTurn.turnNumber;
  const requestLabel =
    lastTurn.requestType === "teamPreview"
      ? "planning the lead"
      : lastTurn.requestType === "switch"
        ? "considering the switch"
        : "considering the next move";

  return {
    id: `system-thinking-${battle.turns.length}`,
    side: nextSide,
    speaker: nextSpeaker,
    content: `${nextSpeaker} is ${requestLabel}...`,
    meta: `Turn ${nextTurnNumber} · thinking`,
    pending: true,
  };
}

export function LiveBattle({ initialBattle }: { initialBattle: LiveBattlePayload }) {
  usePageScrollLock();
  const normalizedInitialBattle = normalizeBattlePayload(initialBattle);
  const [battle, setBattle] = useState(normalizedInitialBattle);
  const [activeTab, setActiveTab] = useState("thoughts");
  const [stopPending, setStopPending] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [moveDexById, setMoveDexById] = useState<Record<string, DexMoveEntry>>({});

  useEffect(() => {
    if (isBattleTerminal(battle.status)) {
      return;
    }

    const interval = setInterval(async () => {
      const response = await fetch(`/api/battles/${battle.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = normalizeBattlePayload((await response.json()) as LiveBattlePayload);
      setBattle((current) => {
        const mergedPayload = mergeBattlePayload(current, payload);
        return hasMeaningfulBattleChange(current, mergedPayload) ? mergedPayload : current;
      });
      if (isBattleTerminal(payload.status)) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [battle.id, battle.status]);

  const currentTurn = useMemo(() => battle.turns.at(-1) ?? null, [battle.turns]);

  const currentUsage = useMemo(() => {
    return parseJsonSafely<{
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
      attempts?: number;
      repairAttempts?: number;
    }>(currentTurn?.tokenUsageJson);
  }, [currentTurn?.tokenUsageJson]);

  const parsedObservations = useMemo(() => {
    return battle.turns
      .map((turn) => parseObservation(turn.observationJson))
      .filter((observation): observation is PublicBattleObservation => Boolean(observation));
  }, [battle.turns]);

  const p1SideObservation = useMemo(
    () => applyTerminalSideState(battle, "p1", getLatestSideObservation(parsedObservations, "p1")),
    [battle, parsedObservations]
  );

  const p2SideObservation = useMemo(
    () => applyTerminalSideState(battle, "p2", getLatestSideObservation(parsedObservations, "p2")),
    [battle, parsedObservations]
  );

  const p1Active = useMemo(() => {
    return describeActiveGroup(p1SideObservation.active);
  }, [p1SideObservation.active]);

  const p2Active = useMemo(() => {
    return describeActiveGroup(p2SideObservation.active);
  }, [p2SideObservation.active]);

  const p1MovesRaw = useMemo(
    () => getActiveMoves(p1SideObservation.active),
    [p1SideObservation.active]
  );
  const p2MovesRaw = useMemo(
    () => getActiveMoves(p2SideObservation.active),
    [p2SideObservation.active]
  );

  const p1RequestMoves = useMemo(
    () =>
      getLatestSideRequestMoves(
        battle.turns,
        "p1",
        p1SideObservation.active.map((pokemon) => pokemon.species)
      ),
    [battle.turns, p1SideObservation.active]
  );

  const p2RequestMoves = useMemo(
    () =>
      getLatestSideRequestMoves(
        battle.turns,
        "p2",
        p2SideObservation.active.map((pokemon) => pokemon.species)
      ),
    [battle.turns, p2SideObservation.active]
  );

  const p1HighlightedMoveIds = useMemo(
    () =>
      getLatestSideChosenMoveIds(
        battle.turns,
        "p1",
        p1SideObservation.active.map((pokemon) => pokemon.species)
      ),
    [battle.turns, p1SideObservation.active]
  );

  const p2HighlightedMoveIds = useMemo(
    () =>
      getLatestSideChosenMoveIds(
        battle.turns,
        "p2",
        p2SideObservation.active.map((pokemon) => pokemon.species)
      ),
    [battle.turns, p2SideObservation.active]
  );

  const resolvedP1MovesRaw = p1RequestMoves.length > 0 ? p1RequestMoves : p1MovesRaw;
  const resolvedP2MovesRaw = p2RequestMoves.length > 0 ? p2RequestMoves : p2MovesRaw;

  const activeMoveIds = useMemo(
    () =>
      Array.from(new Set([...resolvedP1MovesRaw, ...resolvedP2MovesRaw].map((move) => move.id))),
    [resolvedP1MovesRaw, resolvedP2MovesRaw]
  );

  useEffect(() => {
    const missingMoveIds = activeMoveIds.filter((moveId) => !moveDexById[moveId]);
    if (missingMoveIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadMoves() {
      const entries = await Promise.all(
        missingMoveIds.map(async (moveId) => {
          const response = await fetch(`/api/dex/moves/${moveId}`, { cache: "force-cache" });
          if (!response.ok) {
            return null;
          }

          const payload = (await response.json()) as DexMoveEntry;
          return payload;
        })
      );

      if (cancelled) {
        return;
      }

      setMoveDexById((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (!entry) continue;
          next[entry.id] = entry;
        }
        return next;
      });
    }

    void loadMoves();

    return () => {
      cancelled = true;
    };
  }, [activeMoveIds, moveDexById]);

  const p1Moves = useMemo<BattleArenaMove[]>(
    () =>
      resolvedP1MovesRaw.map((moveEntry) => {
        const move = moveDexById[moveEntry.id];
        return {
          id: moveEntry.id,
          name: move?.name ?? moveEntry.name,
          type: move?.type ?? null,
          pp: moveEntry.pp ?? move?.pp ?? null,
          maxPp: moveEntry.maxPp ?? move?.pp ?? null,
        };
      }),
    [moveDexById, resolvedP1MovesRaw]
  );

  const p2Moves = useMemo<BattleArenaMove[]>(
    () =>
      resolvedP2MovesRaw.map((moveEntry) => {
        const move = moveDexById[moveEntry.id];
        return {
          id: moveEntry.id,
          name: move?.name ?? moveEntry.name,
          type: move?.type ?? null,
          pp: moveEntry.pp ?? move?.pp ?? null,
          maxPp: moveEntry.maxPp ?? move?.pp ?? null,
        };
      }),
    [moveDexById, resolvedP2MovesRaw]
  );

  const currentActionEvent = useMemo(
    () => getTurnActionEvent(currentTurn, moveDexById),
    [currentTurn, moveDexById]
  );

  const team1PreviewSpecies = useMemo(
    () => extractTeamPreviewSpecies(battle.team1.importable ?? ""),
    [battle.team1.importable]
  );
  const team1Roster = useMemo(
    () => parseImportableTeam(battle.team1.importable ?? ""),
    [battle.team1.importable]
  );
  const team2PreviewSpecies = useMemo(
    () => extractTeamPreviewSpecies(battle.team2.importable ?? ""),
    [battle.team2.importable]
  );
  const team2Roster = useMemo(
    () => parseImportableTeam(battle.team2.importable ?? ""),
    [battle.team2.importable]
  );

  const topSideSprites = useMemo(() => {
    return buildTeamSprites(
      team2PreviewSpecies,
      p2SideObservation.active,
      p2SideObservation.bench,
      "front"
    );
  }, [p2SideObservation.active, p2SideObservation.bench, team2PreviewSpecies]);

  const bottomSideSprites = useMemo(() => {
    return buildTeamSprites(
      team1PreviewSpecies,
      p1SideObservation.active,
      p1SideObservation.bench,
      "back"
    );
  }, [p1SideObservation.active, p1SideObservation.bench, team1PreviewSpecies]);

  const battleOutcome = useMemo(() => getBattleOutcome(battle), [battle]);
  const pendingThinkingMessage = useMemo(() => getPendingThinkingMessage(battle), [battle]);

  const thoughtMessages = useMemo<ThoughtChatMessage[]>(() => {
    const turnMessages = battle.turns
      .filter((turn) => turn.publicReasoning || turn.chosenAction)
      .map<ThoughtChatMessage>((turn) => ({
        id: turn.id,
        side: (turn.actingSide === "p1" ? "p1" : "p2") as "p1" | "p2",
        speaker: turn.actingSide === "p1" ? battle.agent1.name : battle.agent2.name,
        content:
          turn.publicReasoning ??
          `Selected ${turn.chosenAction} with no public reasoning recorded.`,
        meta: `Turn ${turn.turnNumber} · ${turn.chosenAction}`,
      }));

    if (battle.summary.error) {
      turnMessages.push({
        id: "system-error",
        side: "system",
        speaker: "System",
        content: battle.summary.error,
        meta:
          battle.status === "failed"
            ? "Battle failed"
            : battle.status === "cancelled"
              ? "Battle cancelled"
              : "Runtime warning",
      });
    }

    if (battleOutcome) {
      turnMessages.push({
        id: "system-outcome",
        side: "system",
        speaker: "System",
        content: `${battleOutcome.title}. ${battleOutcome.subtitle}`,
        meta: battleOutcome.meta,
      });
    }

    if (pendingThinkingMessage) {
      turnMessages.push(pendingThinkingMessage);
    }

    if (turnMessages.length > 0) {
      return turnMessages;
    }

    return [
      {
        id: "system-waiting",
        side: "system",
        speaker: "System",
        content: "Waiting for the first agent decisions. Their thinking traces will stream here.",
      },
    ];
  }, [
    battle.agent1.name,
    battle.agent2.name,
    battle.status,
    battle.summary.error,
    battle.turns,
    battleOutcome,
    pendingThinkingMessage,
  ]);

  const canStopBattle = battle.status === "pending" || battle.status === "running";

  async function stopBattle() {
    if (!canStopBattle || stopPending) {
      return;
    }

    setStopPending(true);
    setStopError(null);

    try {
      const response = await fetch(`/api/battles/${battle.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      const payload = (await response.json().catch(() => null)) as
        | LiveBattlePayload
        | { error?: string }
        | null;

      if (!response.ok) {
        setStopError(
          payload && "error" in payload ? payload.error ?? "Stop request failed" : "Stop request failed"
        );
        return;
      }

      setBattle(normalizeBattlePayload(payload as LiveBattlePayload));
    } finally {
      setStopPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 max-h-full flex-1 overflow-hidden rounded-xl border bg-card">
      <div className="grid h-full min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <BattleArena
            className="h-full min-h-0"
            title={`${battle.agent1.name} vs ${battle.agent2.name}`}
            subtitle={`${battle.team1.name} vs ${battle.team2.name}`}
            status={battle.status}
            formatLabel={battle.formatId}
            actionEvent={currentActionEvent}
            topSide={{
              trainerName: battle.agent2.name,
              teamName: battle.team2.name,
              activeLabel: p2Active.activeLabel,
              detail: p2Active.detail,
              hpPercent: p2Active.hpPercent,
              status: p2Active.status,
              moves: p2Moves,
              highlightedMoveIds: p2HighlightedMoveIds,
              roster: team2Roster,
              highlightedSpecies: topSideSprites.highlightedSpecies,
              activeSprites: topSideSprites.activeSprites,
              sprites: topSideSprites.sprites,
            }}
            bottomSide={{
              trainerName: battle.agent1.name,
              teamName: battle.team1.name,
              activeLabel: p1Active.activeLabel,
              detail: p1Active.detail,
              hpPercent: p1Active.hpPercent,
              status: p1Active.status,
              moves: p1Moves,
              highlightedMoveIds: p1HighlightedMoveIds,
              roster: team1Roster,
              highlightedSpecies: bottomSideSprites.highlightedSpecies,
              activeSprites: bottomSideSprites.activeSprites,
              sprites: bottomSideSprites.sprites,
            }}
          />
        </div>

        <div className="h-full min-h-0 overflow-hidden">
          <section className="grid h-full min-h-0 max-h-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-t xl:border-t-0 xl:border-l">
            {stopError || canStopBattle ? (
              <div className="border-b px-4 py-3 md:px-5">
                <div className="flex min-h-8 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {stopError ? <p className="text-sm text-destructive">{stopError}</p> : null}
                  </div>
                  <div className="ml-auto flex items-center justify-end gap-2">
                    {canStopBattle ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={stopBattle}
                        disabled={stopPending}
                      >
                        {stopPending ? "Stopping..." : "Stop Battle"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="min-h-0 overflow-hidden p-4 md:p-5">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden"
              >
                <TabsList className="w-full shrink-0 justify-start">
                  <TabsTrigger value="thoughts">Agent Thinking</TabsTrigger>
                  <TabsTrigger value="overview">Config</TabsTrigger>
                  <TabsTrigger value="log">Battle Log</TabsTrigger>
                </TabsList>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <TabsContent
                    value="thoughts"
                    className="absolute inset-0 mt-0 flex min-h-0 flex-col overflow-hidden"
                  >
                    <AgentThoughtChat
                      messages={thoughtMessages}
                      emptyMessage="No reasoning traces have been recorded yet."
                    />
                  </TabsContent>

                  <TabsContent
                    value="overview"
                    className="absolute inset-0 mt-0 overflow-y-auto overflow-x-hidden pr-1"
                  >
                    <div className="space-y-3">
                      <Card className="gap-0 py-0 shadow-none">
                        <CardHeader className="px-4 py-4">
                          <CardTitle className="text-sm">Current action</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0 text-sm text-muted-foreground">
                          {currentTurn
                            ? `${currentTurn.actingSide === "p1" ? battle.agent1.name : battle.agent2.name} chose ${currentTurn.chosenAction}.`
                            : "No turn data yet."}
                        </CardContent>
                      </Card>

                      <Card className="gap-0 py-0 shadow-none">
                        <CardHeader className="px-4 py-4">
                          <CardTitle className="text-sm">Battle details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 px-4 pb-4 pt-0 text-sm">
                          <dl className="rounded-lg border bg-muted/20">
                            <div className="flex items-center justify-between gap-4 border-b px-3 py-2.5">
                              <dt className="text-muted-foreground">Request type</dt>
                              <dd className="font-medium text-foreground">
                                {currentTurn?.requestType ?? "n/a"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 border-b px-3 py-2.5">
                              <dt className="text-muted-foreground">Latency</dt>
                              <dd className="font-medium text-foreground">
                                {currentTurn ? `${currentTurn.latencyMs} ms` : "n/a"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 border-b px-3 py-2.5">
                              <dt className="text-muted-foreground">Token usage</dt>
                              <dd className="font-medium text-foreground">
                                {currentUsage?.totalTokens ?? "n/a"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                              <dt className="text-muted-foreground">Prompt repairs</dt>
                              <dd className="font-medium text-foreground">
                                {currentUsage?.repairAttempts ?? 0}
                              </dd>
                            </div>
                          </dl>
                        </CardContent>
                      </Card>

                      {battle.summary.error ? (
                        <Card className="gap-0 border-destructive/30 bg-destructive/5 py-0 shadow-none">
                          <CardContent className="px-4 py-3 text-sm text-destructive">
                            {battle.summary.error}
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="log"
                    className="absolute inset-0 mt-0 flex min-h-0 overflow-hidden"
                  >
                    <Card className="min-h-0 flex-1 gap-0 py-0 shadow-none">
                      <CardContent className="min-h-0 flex-1 p-0">
                        <pre className="mono h-full overflow-auto p-4 text-xs text-foreground">
                          {battle.summary.log.join("\n") || "Log pending..."}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
            {battleOutcome ? (
              <div className="border-t px-4 py-3 md:px-5">
                <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 whitespace-nowrap px-3 text-xs"
                    onClick={() => setActiveTab("log")}
                  >
                    Log
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 whitespace-nowrap px-3 text-xs"
                  >
                    <Link href="/battles/new">New Battle</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 whitespace-nowrap px-3 text-xs"
                  >
                    <Link href="/benchmarks">Benchmarks</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
