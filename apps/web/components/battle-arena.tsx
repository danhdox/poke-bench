"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { ItemDisplay } from "./item-display";
import type { TeamPreviewMember } from "../lib/pokemon-sprites";
import { toPokemonId } from "../lib/pokemon-sprites";
import { getItemSpriteUrl } from "../lib/item-sprites";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type BattleArenaMove = {
  id: string;
  name: string;
  type?: string | null;
  pp?: number | null;
  maxPp?: number | null;
};

export type BattleArenaActionEvent = {
  key: string;
  side: "p1" | "p2";
  moveId: string;
  moveName: string;
  moveType?: string | null;
  targetHint?: number | null;
};

type BattleArenaSide = {
  trainerName: string;
  teamName: string;
  activeLabel: string;
  detail: string;
  hpPercent?: number | null;
  status?: string | null;
  moves?: BattleArenaMove[];
  highlightedMoveIds?: string[];
  showMeter?: boolean;
  roster?: TeamPreviewMember[];
  highlightedSpecies?: string[];
  activeSprites?: Array<{
    url: string;
    alt: string;
    hpPercent?: number | null;
    fainted?: boolean;
  }>;
  activeBoosts?: Array<{
    species: string;
    boosts: Record<string, number>;
  }>;
  activeStatuses?: Array<{
    species: string;
    status?: string | null;
  }>;
  sprites?: Array<{
    url: string;
    alt: string;
    hpPercent?: number | null;
    fainted?: boolean;
  }>;
};

type BattleArenaProps = {
  title: string;
  subtitle: string;
  status: string;
  formatLabel: string;
  topSide: BattleArenaSide;
  bottomSide: BattleArenaSide;
  actionEvent?: BattleArenaActionEvent | null;
  previewMatchup?: {
    leftLabel: string;
    rightLabel: string;
  };
  previewIntroState?: "idle" | "launching";
  className?: string;
};

type DexPokemonEntry = {
  id: string;
  name: string;
  types: string[];
  abilities: Record<string, string>;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  bst: number;
};

type DexMoveEntry = {
  id: string;
  name: string;
  type: string;
  pp: number;
  shortDesc?: string | null;
};

type DexAbilityEntry = {
  id: string;
  name: string;
  rating: number;
  shortDesc?: string | null;
};

type StageSprite = {
  url: string;
  alt: string;
  hpPercent?: number | null;
  fainted?: boolean;
};

function getHpTone(percent?: number | null) {
  if (percent === null || percent === undefined) {
    return "bg-foreground/20";
  }
  if (percent <= 25) return "bg-red-500";
  if (percent <= 50) return "bg-amber-500";
  return "bg-emerald-500";
}

function getStatusClasses(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "brn":
    case "burn":
      return "border-rose-300/80 bg-rose-100 text-rose-800";
    case "par":
    case "para":
      return "border-yellow-300/80 bg-yellow-100 text-yellow-900";
    case "frz":
    case "freeze":
    case "frozen":
      return "border-cyan-300/80 bg-cyan-100 text-cyan-900";
    case "slp":
    case "sleep":
      return "border-indigo-300/80 bg-indigo-100 text-indigo-900";
    case "psn":
    case "poison":
      return "border-violet-300/80 bg-violet-100 text-violet-900";
    case "tox":
    case "toxic":
      return "border-fuchsia-300/80 bg-fuchsia-100 text-fuchsia-900";
    case "fnt":
      return "border-slate-300/80 bg-slate-200 text-slate-800";
    default:
      return "border-black/10 bg-white/70 text-foreground/75";
  }
}

function getBoostLabel(stat: string) {
  switch (stat.toLowerCase()) {
    case "atk":
      return "Atk";
    case "def":
      return "Def";
    case "spa":
      return "SpA";
    case "spd":
      return "SpD";
    case "spe":
      return "Spe";
    case "accuracy":
      return "Acc";
    case "evasion":
      return "Eva";
    default:
      return stat;
  }
}

function getVisibleBoostChips(boosts: Record<string, number> | undefined) {
  return Object.entries(boosts ?? {})
    .filter(([, stage]) => typeof stage === "number" && stage !== 0)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .map(([stat, stage]) => ({
      key: stat,
      label: `${getBoostLabel(stat)} ${stage > 0 ? `+${stage}` : stage}`,
      positive: stage > 0,
    }));
}

function getInlineSpriteFallback(label: string) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 18);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="20" fill="#f8fafc"/>
      <circle cx="80" cy="80" r="38" fill="#ffffff" stroke="#cbd5e1" stroke-width="6"/>
      <path d="M42 80h76" stroke="#cbd5e1" stroke-width="6"/>
      <circle cx="80" cy="80" r="10" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="4"/>
      <text x="80" y="140" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" fill="#64748b">${safeLabel}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getStageTransitionClasses(
  phase: "idle" | "recalling" | "sending",
  align: "left" | "right"
) {
  if (phase === "recalling") {
    return align === "left"
      ? "opacity-0 scale-75 -translate-x-4 translate-y-5"
      : "opacity-0 scale-75 translate-x-4 -translate-y-5";
  }

  if (phase === "sending") {
    return align === "left"
      ? "opacity-0 scale-50 -translate-x-8 translate-y-8"
      : "opacity-0 scale-50 translate-x-8 -translate-y-8";
  }

  return "opacity-100 scale-100 translate-x-0 translate-y-0";
}

function getMoveTypeClasses(type?: string | null) {
  switch ((type ?? "").toLowerCase()) {
    case "bug":
      return { card: "border-border bg-card", type: "bg-lime-100 text-lime-700", meta: "text-muted-foreground" };
    case "dark":
      return { card: "border-border bg-card", type: "bg-slate-100 text-slate-700", meta: "text-muted-foreground" };
    case "dragon":
      return { card: "border-border bg-card", type: "bg-violet-100 text-violet-700", meta: "text-muted-foreground" };
    case "electric":
      return { card: "border-border bg-card", type: "bg-yellow-100 text-yellow-700", meta: "text-muted-foreground" };
    case "fairy":
      return { card: "border-border bg-card", type: "bg-pink-100 text-pink-700", meta: "text-muted-foreground" };
    case "fighting":
      return { card: "border-border bg-card", type: "bg-orange-100 text-orange-700", meta: "text-muted-foreground" };
    case "fire":
      return { card: "border-border bg-card", type: "bg-rose-100 text-rose-700", meta: "text-muted-foreground" };
    case "flying":
      return { card: "border-border bg-card", type: "bg-sky-100 text-sky-700", meta: "text-muted-foreground" };
    case "ghost":
      return { card: "border-border bg-card", type: "bg-indigo-100 text-indigo-700", meta: "text-muted-foreground" };
    case "grass":
      return { card: "border-border bg-card", type: "bg-emerald-100 text-emerald-700", meta: "text-muted-foreground" };
    case "ground":
      return { card: "border-border bg-card", type: "bg-amber-100 text-amber-700", meta: "text-muted-foreground" };
    case "ice":
      return { card: "border-border bg-card", type: "bg-cyan-100 text-cyan-700", meta: "text-muted-foreground" };
    case "normal":
      return { card: "border-border bg-card", type: "bg-stone-100 text-stone-700", meta: "text-muted-foreground" };
    case "poison":
      return { card: "border-border bg-card", type: "bg-fuchsia-100 text-fuchsia-700", meta: "text-muted-foreground" };
    case "psychic":
      return { card: "border-border bg-card", type: "bg-rose-100 text-rose-700", meta: "text-muted-foreground" };
    case "rock":
      return { card: "border-border bg-card", type: "bg-stone-100 text-stone-700", meta: "text-muted-foreground" };
    case "steel":
      return { card: "border-border bg-card", type: "bg-slate-100 text-slate-700", meta: "text-muted-foreground" };
    case "water":
      return { card: "border-border bg-card", type: "bg-blue-100 text-blue-700", meta: "text-muted-foreground" };
    default:
      return { card: "border-border bg-card", type: "bg-muted text-muted-foreground", meta: "text-muted-foreground" };
  }
}

function getPreviewMoveTypeClasses(type?: string | null) {
  switch ((type ?? "").toLowerCase()) {
    case "bug":
      return { card: "border-lime-200 bg-lime-50/70", type: "text-lime-700", meta: "text-lime-800/70" };
    case "dark":
      return { card: "border-slate-300 bg-slate-50/80", type: "text-slate-700", meta: "text-slate-700/70" };
    case "dragon":
      return { card: "border-violet-200 bg-violet-50/70", type: "text-violet-700", meta: "text-violet-800/70" };
    case "electric":
      return { card: "border-yellow-200 bg-yellow-50/80", type: "text-yellow-700", meta: "text-yellow-800/70" };
    case "fairy":
      return { card: "border-pink-200 bg-pink-50/80", type: "text-pink-700", meta: "text-pink-800/70" };
    case "fighting":
      return { card: "border-orange-200 bg-orange-50/80", type: "text-orange-700", meta: "text-orange-800/70" };
    case "fire":
      return { card: "border-rose-200 bg-rose-50/75", type: "text-rose-700", meta: "text-rose-800/70" };
    case "flying":
      return { card: "border-sky-200 bg-sky-50/75", type: "text-sky-700", meta: "text-sky-800/70" };
    case "ghost":
      return { card: "border-indigo-200 bg-indigo-50/75", type: "text-indigo-700", meta: "text-indigo-800/70" };
    case "grass":
      return { card: "border-emerald-200 bg-emerald-50/75", type: "text-emerald-700", meta: "text-emerald-800/70" };
    case "ground":
      return { card: "border-amber-200 bg-amber-50/80", type: "text-amber-700", meta: "text-amber-800/70" };
    case "ice":
      return { card: "border-cyan-200 bg-cyan-50/80", type: "text-cyan-700", meta: "text-cyan-800/70" };
    case "normal":
      return { card: "border-stone-200 bg-stone-50/80", type: "text-stone-700", meta: "text-stone-700/70" };
    case "poison":
      return { card: "border-fuchsia-200 bg-fuchsia-50/75", type: "text-fuchsia-700", meta: "text-fuchsia-800/70" };
    case "psychic":
      return { card: "border-rose-200 bg-rose-50/75", type: "text-rose-700", meta: "text-rose-800/70" };
    case "rock":
      return { card: "border-stone-200 bg-stone-50/80", type: "text-stone-700", meta: "text-stone-700/70" };
    case "steel":
      return { card: "border-slate-200 bg-slate-50/80", type: "text-slate-700", meta: "text-slate-700/70" };
    case "water":
      return { card: "border-blue-200 bg-blue-50/75", type: "text-blue-700", meta: "text-blue-800/70" };
    default:
      return { card: "border-border bg-background", type: "text-muted-foreground", meta: "text-muted-foreground" };
  }
}

function toMoveId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getMoveEffectCategory(
  moveId: string,
  type?: string | null
): "projectile" | "shockwave" | "pulse" | "slash" {
  const normalizedMoveId = moveId.toLowerCase();
  const normalizedType = (type ?? "").toLowerCase();

  if (
    [
      "spikes",
      "stealthrock",
      "stickyweb",
      "toxicspikes",
      "toxic",
      "roost",
      "recover",
      "substitute",
      "dragondance",
      "swordsdance",
      "calmmind",
      "nastyplot",
      "bulkup",
      "protect",
    ].includes(normalizedMoveId)
  ) {
    return "pulse";
  }

  if (
    normalizedType === "ground" ||
    ["earthquake", "headlongrush", "stoneedge", "rockslide", "bulldoze"].includes(
      normalizedMoveId
    )
  ) {
    return "shockwave";
  }

  if (
    normalizedType === "dark" ||
    normalizedType === "steel" ||
    normalizedType === "fighting" ||
    ["knockoff", "firepunch", "icepunch", "thunderpunch", "dragontail"].includes(
      normalizedMoveId
    )
  ) {
    return "slash";
  }

  return "projectile";
}

function getMoveEffectPalette(type?: string | null) {
  switch ((type ?? "").toLowerCase()) {
    case "grass":
    case "bug":
      return { core: "#34d399", glow: "rgba(52,211,153,0.16)", text: "text-emerald-700" };
    case "fire":
    case "fighting":
    case "electric":
    case "ground":
    case "rock":
      return { core: "#f59e0b", glow: "rgba(245,158,11,0.16)", text: "text-amber-700" };
    case "water":
    case "ice":
    case "flying":
    case "dragon":
      return { core: "#60a5fa", glow: "rgba(96,165,250,0.16)", text: "text-sky-700" };
    case "poison":
    case "psychic":
    case "fairy":
    case "ghost":
      return { core: "#c084fc", glow: "rgba(192,132,252,0.14)", text: "text-violet-700" };
    case "steel":
    case "dark":
    case "normal":
      return { core: "#94a3b8", glow: "rgba(148,163,184,0.16)", text: "text-slate-700" };
    default:
      return { core: "#60a5fa", glow: "rgba(96,165,250,0.16)", text: "text-sky-700" };
  }
}

function BattleArenaSideCard({
  side,
  accent,
  align,
  previewIntroState = "idle",
}: {
  side: BattleArenaSide;
  accent: "sky" | "amber";
  align: "left" | "right";
  previewIntroState?: "idle" | "launching";
}) {
  const palette =
    accent === "sky"
      ? {
          surface: "bg-card/95",
          border: "border-border",
          tag: "border-sky-200 bg-sky-50 text-sky-700",
          detail: "text-muted-foreground",
        }
      : {
          surface: "bg-card/95",
          border: "border-border",
          tag: "border-amber-200 bg-amber-50 text-amber-700",
          detail: "text-muted-foreground",
        };
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dexById, setDexById] = useState<Record<string, DexPokemonEntry>>({});
  const [moveDexById, setMoveDexById] = useState<Record<string, DexMoveEntry>>({});
  const [abilityDexById, setAbilityDexById] = useState<Record<string, DexAbilityEntry>>({});
  const teamSlots = useMemo(
    () => Array.from({ length: 6 }, (_, index) => side.sprites?.[index] ?? null),
    [side.sprites]
  );
  const showMeter = side.showMeter ?? true;
  const isPreviewLayout = !showMeter && (!side.moves || side.moves.length === 0);
  const isLaunchingPreview = isPreviewLayout && previewIntroState === "launching";
  const highlightedSpecies = useMemo(
    () => new Set(side.highlightedSpecies ?? []),
    [side.highlightedSpecies]
  );
  const highlightedMoves = useMemo(
    () => new Set(side.highlightedMoveIds ?? []),
    [side.highlightedMoveIds]
  );
  const previewSideLabel = align === "left" ? "Player 1" : "Player 2";
  const rosterSlots = useMemo(
    () => Array.from({ length: 6 }, (_, index) => side.roster?.[index] ?? null),
    [side.roster]
  );
  const populatedSlots = useMemo(
    () =>
      rosterSlots
        .map((entry, index) => ({ entry, index }))
        .filter((slot): slot is { entry: TeamPreviewMember; index: number } => Boolean(slot.entry)),
    [rosterSlots]
  );

  useEffect(() => {
    if (!isPreviewLayout) {
      return;
    }

    const preferredIndex = populatedSlots.find((slot) =>
      highlightedSpecies.has(slot.entry.species)
    )?.index;

    if (preferredIndex !== undefined) {
      setSelectedIndex((current) => (current === preferredIndex ? current : preferredIndex));
      return;
    }

    setSelectedIndex((current) => {
      if (rosterSlots[current]) {
        return current;
      }

      return populatedSlots[0]?.index ?? 0;
    });
  }, [highlightedSpecies, isPreviewLayout, populatedSlots, rosterSlots]);

  const inspectedRoster = rosterSlots[selectedIndex] ?? populatedSlots[0]?.entry ?? null;
  const inspectedSpecies = inspectedRoster?.species ?? null;
  const inspectedDexId = inspectedSpecies ? toPokemonId(inspectedSpecies) : null;
  const inspectedAbilityId = inspectedRoster?.ability ? toPokemonId(inspectedRoster.ability) : null;
  const inspectedMoveIds = useMemo(
    () =>
      Array.from(
        new Set((inspectedRoster?.moves ?? []).map((move) => toMoveId(move)).filter(Boolean))
      ),
    [inspectedRoster]
  );
  const rosterDexIds = useMemo(
    () =>
      Array.from(
        new Set(populatedSlots.map((slot) => toPokemonId(slot.entry.species)).filter(Boolean))
      ),
    [populatedSlots]
  );

  useEffect(() => {
    if (!isPreviewLayout) {
      return;
    }

    const missingDexIds = rosterDexIds.filter((id) => !dexById[id]);
    if (missingDexIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadDexEntries() {
      const entries = await Promise.all(
        missingDexIds.map(async (id) => {
          const response = await fetch(`/api/dex/pokemon/${id}`, { cache: "force-cache" });
          if (!response.ok) {
            return null;
          }

          return (await response.json()) as DexPokemonEntry;
        })
      );

      if (cancelled) {
        return;
      }

      setDexById((current) => ({
        ...current,
        ...Object.fromEntries(
          entries.filter((entry): entry is DexPokemonEntry => Boolean(entry)).map((entry) => [
            entry.id,
            entry,
          ])
        ),
      }));
    }

    void loadDexEntries();

    return () => {
      cancelled = true;
    };
  }, [dexById, isPreviewLayout, rosterDexIds]);

  const inspectedDex = inspectedDexId ? dexById[inspectedDexId] : null;
  const inspectedAbility = inspectedAbilityId ? abilityDexById[inspectedAbilityId] : null;

  useEffect(() => {
    if (!isPreviewLayout || !inspectedAbilityId || abilityDexById[inspectedAbilityId]) {
      return;
    }

    let cancelled = false;

    async function loadAbilityEntry() {
      const response = await fetch(`/api/dex/abilities/${inspectedAbilityId}`, { cache: "force-cache" });
      if (!response.ok || cancelled) {
        return;
      }

      const entry = (await response.json()) as DexAbilityEntry;
      if (cancelled) {
        return;
      }

      setAbilityDexById((current) => ({
        ...current,
        [entry.id]: entry,
      }));
    }

    void loadAbilityEntry();

    return () => {
      cancelled = true;
    };
  }, [abilityDexById, inspectedAbilityId, isPreviewLayout]);

  useEffect(() => {
    if (!isPreviewLayout) {
      return;
    }

    const missingMoveIds = inspectedMoveIds.filter((id) => !moveDexById[id]);
    if (missingMoveIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadMoveEntries() {
      const entries = await Promise.all(
        missingMoveIds.map(async (id) => {
          const response = await fetch(`/api/dex/moves/${id}`, { cache: "force-cache" });
          if (!response.ok) {
            return null;
          }

          return (await response.json()) as DexMoveEntry;
        })
      );

      if (cancelled) {
        return;
      }

      setMoveDexById((current) => ({
        ...current,
        ...Object.fromEntries(
          entries.filter((entry): entry is DexMoveEntry => Boolean(entry)).map((entry) => [
            entry.id,
            entry,
          ])
        ),
      }));
    }

    void loadMoveEntries();

    return () => {
      cancelled = true;
    };
  }, [inspectedMoveIds, isPreviewLayout, moveDexById]);

  const teamGrid = (
    <div
      className={cn(
        "grid w-[3.5rem] shrink-0 grid-cols-1 gap-1.5 sm:w-[3.75rem]"
      )}
    >
      {teamSlots.map((sprite, index) => {
        const rosterEntry = rosterSlots[index];
        const canInspect = Boolean(isPreviewLayout && rosterEntry);
        const isSelected = canInspect && selectedIndex === index;

        return (
        <button
          key={sprite?.url ?? `${side.trainerName}-slot-${index}`}
          type="button"
          title={rosterEntry?.species ?? sprite?.alt ?? ""}
          onClick={() => {
            if (!canInspect) return;
            setSelectedIndex(index);
          }}
          disabled={!canInspect}
          className={cn(
            "relative flex aspect-square items-center justify-center rounded-md border bg-background p-1 text-left transition",
            sprite && highlightedSpecies.has(sprite.alt)
              ? "border-emerald-400 bg-emerald-50"
              : null,
            sprite?.fainted ? "bg-muted/50" : null,
            canInspect ? "cursor-pointer hover:bg-accent" : "cursor-default",
            isSelected ? "border-primary/40 bg-accent" : null,
            isPreviewLayout ? "duration-500 ease-out" : null,
            isLaunchingPreview
              ? isSelected
                ? "scale-[1.03] shadow-sm"
                : "scale-95 opacity-55"
              : null
          )}
        >
          {sprite ? (
            <>
              <img
                src={sprite.url}
                alt={sprite.alt}
                className={cn(
                  "max-h-full max-w-full object-contain drop-shadow-[0_4px_8px_rgba(15,23,42,0.12)]",
                  sprite.fainted ? "grayscale opacity-45" : null
                )}
                loading="eager"
                decoding="async"
              />
              {sprite.hpPercent !== null && sprite.hpPercent !== undefined ? (
                <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      sprite.fainted ? "bg-slate-400" : getHpTone(sprite.hpPercent)
                    )}
                    style={{
                      width: `${Math.max(0, Math.min(100, sprite.hpPercent))}%`,
                    }}
                  />
                </div>
              ) : null}
              {rosterEntry?.item ? (
                <div
                  className="absolute bottom-1 right-1 flex size-4 items-center justify-center"
                  title={rosterEntry.item}
                >
                  <img
                    src={getItemSpriteUrl(rosterEntry.item)}
                    alt={rosterEntry.item}
                    className="size-3 object-contain drop-shadow-[0_1px_2px_rgba(15,23,42,0.2)]"
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="size-full rounded-md border border-dashed border-border bg-muted/20" />
          )}
        </button>
      )})}
    </div>
  );

  const previewInfoCard = (
    <div
      className={cn(
        "grid min-h-[20.75rem] w-[17rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border bg-background px-3 py-3 transition-all duration-500 ease-out sm:w-[17.75rem]",
        isLaunchingPreview
          ? cn(
              "min-h-[15rem] w-[16.5rem] rounded-xl shadow-sm",
              align === "left"
                ? "translate-x-8 -translate-y-4 scale-[0.96]"
                : "-translate-x-8 translate-y-4 scale-[0.96]"
            )
          : null
      )}
    >
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{previewSideLabel}</div>
        <div className="text-base font-semibold text-foreground sm:text-lg">{side.activeLabel}</div>
        {isPreviewLayout ? null : (
          <Badge
            variant="secondary"
            className="w-fit border-0 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-none"
          >
            {side.trainerName}
          </Badge>
        )}
      </div>
      <div className="min-h-0 pt-3">
        {inspectedRoster ? (
          <div className="grid min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{inspectedRoster.species}</div>
              <div className={cn("mt-1 text-xs", palette.detail)}>
                {inspectedDex?.types.join(" / ") ?? "Loading typing..."}
              </div>
            </div>
            <div
              className={cn(
                "mt-3 grid grid-cols-2 gap-2 text-xs transition-all duration-400 ease-out",
                isLaunchingPreview ? "max-h-0 -translate-y-2 overflow-hidden opacity-0" : "max-h-40 opacity-100"
              )}
            >
              <div className="rounded-md border bg-background px-2 py-1.5">
                <div className="text-xs text-muted-foreground">
                  Item
                </div>
                <ItemDisplay
                  itemName={inspectedRoster.item}
                  className="mt-1 w-full"
                  textClassName="text-sm"
                  iconClassName="rounded-md border-0 bg-muted/60"
                  showName={false}
                />
              </div>
              <div className="rounded-md border bg-background px-2 py-1.5">
                <div className="text-xs text-muted-foreground">
                  Ability
                </div>
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1 truncate font-medium text-foreground">
                        {inspectedRoster.ability ?? "Unknown"}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6} className="max-w-64 space-y-1.5 px-3 py-2 text-left">
                      <div className="font-medium">{inspectedRoster.ability ?? "Unknown"}</div>
                      <div className="text-[11px] leading-5 text-background/85">
                        {inspectedAbility?.shortDesc ?? "Loading ability description..."}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div
              className={cn(
                "mt-2 grid grid-cols-3 gap-1.5 text-xs transition-all duration-400 ease-out",
                isLaunchingPreview ? "max-h-0 -translate-y-2 overflow-hidden opacity-0" : "max-h-40 opacity-100"
              )}
            >
              {inspectedDex ? (
                <>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">HP</div>
                    <div className="font-semibold">{inspectedDex.baseStats.hp}</div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">Atk</div>
                    <div className="font-semibold">{inspectedDex.baseStats.atk}</div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">Def</div>
                    <div className="font-semibold">{inspectedDex.baseStats.def}</div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">SpA</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spa}</div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">SpD</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spd}</div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1">
                    <div className="text-muted-foreground">Spe</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spe}</div>
                  </div>
                </>
              ) : (
                <div className="col-span-3 rounded-md border bg-background px-2 py-1 text-muted-foreground">
                  Loading quick stats...
                </div>
              )}
            </div>
            <div className="mt-2 min-h-0 overflow-hidden">
              <div
                className={cn(
                  "transition-all duration-400 ease-out",
                  isLaunchingPreview ? "max-h-0 -translate-y-2 overflow-hidden opacity-0" : "max-h-80 opacity-100"
                )}
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Moves
                </div>
                <TooltipProvider delayDuration={120}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {inspectedRoster.moves.slice(0, 4).map((move) => {
                      const moveDex = moveDexById[toMoveId(move)];
                      const palette = getPreviewMoveTypeClasses(moveDex?.type);

                      return (
                        <Tooltip key={`${inspectedRoster.species}-${move}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "rounded-md border px-2 py-1.5 text-xs shadow-sm",
                                palette.card
                              )}
                            >
                              <div className="truncate font-medium text-foreground">
                                {moveDex?.name ?? move}
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className={cn("truncate text-[11px] font-medium uppercase tracking-wide", palette.type)}>
                                  {moveDex?.type ?? "Move"}
                                </span>
                                <span className={cn("shrink-0 text-[11px] font-medium", palette.meta)}>
                                  {moveDex?.pp ? `${moveDex.pp} PP` : "-- PP"}
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6} className="max-w-72 space-y-1.5 px-3 py-2 text-left">
                            <div className="font-medium">{moveDex?.name ?? move}</div>
                            <div className="text-[11px] leading-5 text-background/85">
                              {moveDex?.shortDesc ?? "Loading move description..."}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
              <div
                className={cn(
                  "space-y-3 transition-all duration-500 ease-out",
                  isLaunchingPreview
                    ? "max-h-56 translate-y-0 opacity-100"
                    : "max-h-0 translate-y-2 overflow-hidden opacity-0"
                )}
              >
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 min-w-0 flex-1 rounded-full bg-black/8">
                      <div className="h-full w-[72%] rounded-full bg-emerald-500" />
                    </div>
                    <div className="shrink-0 text-xs font-medium text-foreground/70">--%</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {inspectedRoster.moves.slice(0, 4).map((move) => {
                    const moveDex = moveDexById[toMoveId(move)];
                    const palette = getMoveTypeClasses(moveDex?.type);

                    return (
                      <div
                        key={`${inspectedRoster.species}-launch-${move}`}
                        className={cn("rounded-lg border px-2 py-1.5 text-xs shadow-sm", palette.card)}
                      >
                        <div className="truncate font-semibold text-foreground">
                          {moveDex?.name ?? move}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", palette.type)}>
                            {moveDex?.type ?? "Move"}
                          </span>
                          <span className={cn("text-xs font-medium", palette.meta)}>--/--</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-1 py-2 text-sm text-muted-foreground">
            Click a Pokemon in the roster to inspect it.
          </div>
        )}
      </div>
    </div>
  );

  const liveInfoCard = (
    <div
      className={cn(
        `rounded-xl border ${palette.border} ${palette.surface} p-3 shadow-sm`,
        "grid h-[14.5rem] w-[16.5rem] grid-rows-[auto_auto_auto_minmax(0,1fr)] sm:h-[15rem] sm:w-[17.5rem]"
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div className="line-clamp-2 min-w-0 text-base font-semibold text-foreground sm:text-lg">
          {side.activeLabel}
        </div>
        <Badge
          variant="secondary"
          className={cn("border text-xs font-medium shadow-none", palette.tag)}
        >
          {side.trainerName}
        </Badge>
        {side.status ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              getStatusClasses(side.status)
            )}
          >
            {side.status}
          </Badge>
        ) : null}
      </div>
      {side.teamName && side.teamName !== side.activeLabel ? (
        <div className={`pt-1 text-xs ${palette.detail}`}>{side.teamName}</div>
      ) : (
        <div />
      )}
      <div className="space-y-1.5 pt-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 rounded-full bg-black/8">
            <div
              className={`h-full rounded-full ${getHpTone(side.hpPercent)}`}
              style={{
                width: `${
                  side.hpPercent === null || side.hpPercent === undefined
                    ? 18
                    : Math.max(0, Math.min(100, side.hpPercent))
                }%`,
              }}
            />
          </div>
          <div className="shrink-0 text-xs font-medium text-foreground/70">
            {side.hpPercent === null || side.hpPercent === undefined
              ? "--%"
              : `${Math.round(side.hpPercent)}%`}
          </div>
        </div>
        {side.detail ? (
          <div className="text-xs text-foreground/70">{side.detail}</div>
        ) : null}
      </div>
      <div className="pt-2">
        {side.moves && side.moves.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {side.moves.map((move) => {
              const palette = getMoveTypeClasses(move.type);
              const isHighlighted = highlightedMoves.has(move.id);
              return (
                <div
                  key={`${side.trainerName}-${move.id}`}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 shadow-sm transition-all duration-200 ease-out",
                    isHighlighted
                      ? "border-emerald-400 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                      : palette.card
                  )}
                >
                  <div className="truncate text-xs font-semibold text-foreground">
                    {move.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs font-medium",
                        isHighlighted ? "bg-emerald-100 text-emerald-700" : palette.type
                      )}
                    >
                      {move.type ?? "Move"}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isHighlighted ? "text-emerald-900/80" : palette.meta
                      )}
                    >
                      {move.pp !== null && move.pp !== undefined
                        ? `${move.pp}/${move.maxPp ?? move.pp}`
                        : "--/--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  const previewRosterCard = (
    <div
      className={cn(
        "rounded-lg border bg-background p-1.5 transition-all duration-500 ease-out",
        isLaunchingPreview
          ? align === "left"
            ? "translate-x-6 -translate-y-2 scale-95 opacity-70"
            : "-translate-x-6 translate-y-2 scale-95 opacity-70"
          : null
      )}
    >
      {teamGrid}
    </div>
  );

  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "flex gap-3",
          align === "right" ? "flex-row items-start" : "flex-row-reverse items-end"
        )}
      >
        {isPreviewLayout ? previewInfoCard : liveInfoCard}
        {previewRosterCard}
      </div>
    </div>
  );
}

function StageMoveEffectOverlay({
  actionEvent,
}: {
  actionEvent?: BattleArenaActionEvent | null;
}) {
  const [activeEvent, setActiveEvent] = useState<BattleArenaActionEvent | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionEvent) {
      return;
    }

    setActiveEvent(actionEvent);

    const isLeftAttacker = actionEvent.side === "p1";

    if (bannerRef.current) {
      bannerRef.current.animate(
        [
          { opacity: 0, transform: "translate(-50%, 8px) scale(0.96)" },
          { opacity: 1, transform: "translate(-50%, 0) scale(1)" },
          { opacity: 1, transform: "translate(-50%, 0) scale(1)" },
          { opacity: 0, transform: "translate(-50%, -6px) scale(0.98)" },
        ],
        {
          duration: 700,
          easing: "ease-out",
        }
      );
    }

    if (pulseRef.current) {
      pulseRef.current.animate(
        [
          {
            opacity: 0,
            transform: `translate(-50%, -50%) translateX(${isLeftAttacker ? "12rem" : "-12rem"}) scale(0.72)`,
          },
          {
            opacity: 0.9,
            transform: `translate(-50%, -50%) translateX(${isLeftAttacker ? "12rem" : "-12rem"}) scale(1)`,
          },
          {
            opacity: 0,
            transform: `translate(-50%, -50%) translateX(${isLeftAttacker ? "12rem" : "-12rem"}) scale(1.22)`,
          },
        ],
        {
          duration: 520,
          easing: "ease-out",
        }
      );
    }

    const clearTimer = window.setTimeout(() => {
      setActiveEvent((current) => (current?.key === actionEvent.key ? null : current));
    }, 700);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [actionEvent]);

  if (!activeEvent) {
    return null;
  }

  const palette = getMoveEffectPalette(activeEvent.moveType);
  const isLeftAttacker = activeEvent.side === "p1";

  return (
    <div className="absolute inset-0 z-20 overflow-visible pointer-events-none">
      <div
        ref={bannerRef}
        className={cn(
          "absolute top-1/2 rounded-md border bg-background/95 px-3 py-1 text-xs font-medium shadow-sm",
          palette.text
        )}
        style={{
          left: isLeftAttacker ? "37%" : "63%",
          transform: "translate(-50%, -50%)",
          borderColor: palette.glow,
        }}
      >
        {activeEvent.moveName}
      </div>
      <div
        ref={pulseRef}
        className="absolute left-1/2 top-1/2 size-16 rounded-full border bg-background/30 opacity-0"
        style={{
          borderColor: palette.core,
          boxShadow: `0 0 0 1px ${palette.glow}`,
        }}
      />
    </div>
  );
}

function PreviewMatchupLane({
  leftLabel,
  rightLabel,
  introState = "idle",
}: {
  leftLabel: string;
  rightLabel: string;
  introState?: "idle" | "launching";
}) {
  const isLaunching = introState === "launching";

  return (
    <div className="relative mx-auto flex h-12 w-full max-w-3xl items-center justify-center overflow-hidden rounded-lg border bg-background/70 md:h-14 xl:h-16">
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-foreground/[0.045] transition-[width] duration-500 ease-in-out",
          isLaunching ? "w-1/2" : "w-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 bg-foreground/[0.045] transition-[width] duration-500 ease-in-out",
          isLaunching ? "w-1/2" : "w-0"
        )}
      />
      <div className="relative z-10 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 md:px-5">
        <div
          className={cn(
            "min-w-0 truncate text-sm font-medium text-foreground/80 transition-all duration-500 ease-in-out md:text-base",
            isLaunching ? "translate-x-10 opacity-0" : "translate-x-0 opacity-100"
          )}
        >
          {leftLabel}
        </div>
        <div
          className={cn(
            "rounded-md border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-400 ease-in-out",
            isLaunching ? "scale-90 opacity-0" : "scale-100 opacity-100"
          )}
        >
          vs
        </div>
        <div
          className={cn(
            "min-w-0 truncate text-right text-sm font-medium text-foreground/80 transition-all duration-500 ease-in-out md:text-base",
            isLaunching ? "-translate-x-10 opacity-0" : "translate-x-0 opacity-100"
          )}
        >
          {rightLabel}
        </div>
      </div>
    </div>
  );
}

function StageSpriteAnchor({
  align,
  spriteCount,
  previewMode = false,
  children,
}: {
  align: "left" | "right";
  spriteCount: number;
  previewMode?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 pointer-events-none flex items-center overflow-visible",
        spriteCount > 1
          ? "h-24 w-32 md:h-28 md:w-40 xl:h-32 xl:w-44"
          : "h-28 w-28 md:h-32 md:w-32 xl:h-40 xl:w-40",
        previewMode
          ? align === "left"
            ? "bottom-0 left-[8%] translate-y-12 justify-start md:left-[10%] md:translate-y-14 xl:left-[12%] xl:translate-y-16"
            : "right-[10%] top-0 -translate-y-12 justify-end md:right-[12%] md:-translate-y-14 xl:right-[14%] xl:-translate-y-16"
          : align === "left"
            ? "bottom-0 left-[14%] translate-y-10 justify-start md:left-[16%] md:translate-y-12 xl:left-[18%] xl:translate-y-14"
            : "right-[14%] top-0 -translate-y-10 justify-end md:right-[16%] md:-translate-y-12 xl:right-[18%] xl:-translate-y-14"
      )}
    >
      {children}
    </div>
  );
}

function StageSpriteVisual({
  align,
  transitionPhase,
  displayedSprites,
  boostEntries,
  statusEntries,
  damagedKeys,
  impactBurstKeys,
  spriteRefs,
}: {
  align: "left" | "right";
  transitionPhase: "idle" | "recalling" | "sending";
  displayedSprites: StageSprite[];
  boostEntries?: Array<{
    species: string;
    boosts: Record<string, number>;
  }>;
  statusEntries?: Array<{
    species: string;
    status?: string | null;
  }>;
  damagedKeys: string[];
  impactBurstKeys: string[];
  spriteRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const spriteCount = displayedSprites.length;

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-end",
        spriteCount > 1
          ? align === "left"
            ? "justify-start"
            : "justify-end"
          : align === "left"
            ? "justify-start"
            : "justify-end"
      )}
    >
      {displayedSprites.map((sprite, index) => (
        (() => {
          const statusValue =
            statusEntries?.find((entry) => toPokemonId(entry.species) === toPokemonId(sprite.alt))
              ?.status ?? null;
          const boostChips = getVisibleBoostChips(
            boostEntries?.find((entry) => toPokemonId(entry.species) === toPokemonId(sprite.alt))
              ?.boosts
          );

          return (
            <div
              key={`${align}-${sprite.alt}`}
              ref={(node) => {
                spriteRefs.current[sprite.alt] = node;
              }}
              className={cn(
                "relative flex items-end justify-center transition-all duration-200 ease-out will-change-transform",
                spriteCount > 1
                  ? align === "left"
                    ? index === 0
                      ? "z-10 h-full w-[62%]"
                      : "ml-[-14%] h-[82%] w-[54%]"
                    : index === 0
                      ? "z-10 h-full w-[62%]"
                      : "mr-[-14%] h-[82%] w-[54%]"
                  : align === "left"
                    ? "h-full w-full"
                    : "h-[92%] w-[92%]",
                getStageTransitionClasses(transitionPhase, align)
              )}
            >
              {statusValue || boostChips.length > 0 ? (
                <div
                  className={cn(
                    "pointer-events-none absolute -top-7 z-20 flex max-w-[9rem] flex-wrap gap-1",
                    align === "left" ? "left-0 justify-start" : "right-0 justify-end"
                  )}
                >
                  {statusValue ? (
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm",
                        getStatusClasses(statusValue)
                      )}
                    >
                      {statusValue}
                    </span>
                  ) : null}
                  {boostChips.map((chip) => (
                    <span
                      key={`${sprite.alt}-${chip.key}`}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm",
                        chip.positive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      )}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                className={cn(
                  "pointer-events-none absolute inset-[12%] rounded-full bg-foreground/10 blur-sm transition-opacity duration-150",
                  damagedKeys.includes(sprite.alt) ? "opacity-100" : "opacity-0"
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute inset-[8%] rounded-full border border-border/70 bg-background/25 transition-opacity duration-150",
                  impactBurstKeys.includes(sprite.alt) ? "opacity-100" : "opacity-0"
                )}
              />
              <img
                src={sprite.url}
                alt={sprite.alt}
                className={cn(
                  "h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(15,23,42,0.14)]",
                  sprite.fainted ? "grayscale opacity-45" : null,
                  align === "left" ? "object-left-bottom" : "object-right-top"
                )}
                loading="eager"
                decoding="async"
                onError={(event) => {
                  const target = event.currentTarget;
                  target.onerror = null;
                  target.src = getInlineSpriteFallback(sprite.alt);
                }}
              />
            </div>
          );
        })()
      ))}
    </div>
  );
}

function useDisplayedStageSprites(sprites?: StageSprite[]) {
  const activeSprites = useMemo(() => sprites?.slice(0, 2) ?? [], [sprites]);
  const activeSpriteKey = useMemo(
    () => activeSprites.map((sprite) => `${sprite.alt}:${sprite.url}`).join("|"),
    [activeSprites]
  );
  const [displayedSprites, setDisplayedSprites] = useState(activeSprites);
  const [displayedKey, setDisplayedKey] = useState(activeSpriteKey);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "recalling" | "sending">(
    "idle"
  );
  const recallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeSpriteKey === displayedKey) {
      return;
    }

    if (recallTimerRef.current) {
      clearTimeout(recallTimerRef.current);
      recallTimerRef.current = null;
    }
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    const finalizeIncomingSprites = () => {
      setDisplayedSprites(activeSprites);
      setDisplayedKey(activeSpriteKey);

      if (activeSprites.length === 0) {
        setTransitionPhase("idle");
        return;
      }

      setTransitionPhase("sending");
      settleTimerRef.current = setTimeout(() => {
        setTransitionPhase("idle");
        settleTimerRef.current = null;
      }, 220);
    };

    if (displayedSprites.length > 0) {
      setTransitionPhase("recalling");
      recallTimerRef.current = setTimeout(() => {
        recallTimerRef.current = null;
        finalizeIncomingSprites();
      }, 180);
    } else {
      finalizeIncomingSprites();
    }
  }, [activeSpriteKey, activeSprites, displayedKey, displayedSprites.length]);

  useEffect(() => {
    return () => {
      if (recallTimerRef.current) {
        clearTimeout(recallTimerRef.current);
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  return {
    activeSprites,
    activeSpriteKey,
    displayedKey,
    displayedSprites,
    transitionPhase,
  };
}

function useStageDamageReaction({
  activeSprites,
  activeSpriteKey,
  displayedKey,
  align,
  transitionPhase,
  spriteRefs,
}: {
  activeSprites: StageSprite[];
  activeSpriteKey: string;
  displayedKey: string;
  align: "left" | "right";
  transitionPhase: "idle" | "recalling" | "sending";
  spriteRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const [damagedKeys, setDamagedKeys] = useState<string[]>([]);
  const previousHpRef = useRef<Record<string, number | null>>({});

  useEffect(() => {
    const currentHpBySprite = Object.fromEntries(
      activeSprites.map((sprite) => [sprite.alt, sprite.hpPercent ?? null])
    );
    const previousHpBySprite = previousHpRef.current;

    if (activeSpriteKey === displayedKey && transitionPhase === "idle") {
      for (const sprite of activeSprites) {
        const currentHp = currentHpBySprite[sprite.alt];
        const previousHp = previousHpBySprite[sprite.alt];

        if (
          currentHp !== null &&
          currentHp !== undefined &&
          previousHp !== null &&
          previousHp !== undefined &&
          currentHp < previousHp
        ) {
          setDamagedKeys((current) =>
            current.includes(sprite.alt) ? current : [...current, sprite.alt]
          );

          const spriteNode = spriteRefs.current[sprite.alt];
          if (spriteNode) {
            spriteNode.animate(
              [
                {
                  transform: "translateX(0) scale(1)",
                  filter: "brightness(1)",
                },
                {
                  transform:
                    align === "left"
                      ? "translateX(-7px) scale(0.98)"
                      : "translateX(7px) scale(0.98)",
                  filter: "brightness(1.25)",
                },
                {
                  transform:
                    align === "left"
                      ? "translateX(6px) scale(1.01)"
                      : "translateX(-6px) scale(1.01)",
                  filter: "brightness(1.08)",
                },
                {
                  transform:
                    align === "left"
                      ? "translateX(-4px) scale(0.99)"
                      : "translateX(4px) scale(0.99)",
                  filter: "brightness(1.12)",
                },
                {
                  transform: "translateX(0) scale(1)",
                  filter: "brightness(1)",
                },
              ],
              {
                duration: 260,
                easing: "ease-out",
              }
            );
          }

          window.setTimeout(() => {
            setDamagedKeys((current) => current.filter((key) => key !== sprite.alt));
          }, 240);
        }
      }
    }

    previousHpRef.current = currentHpBySprite;
  }, [activeSpriteKey, activeSprites, align, displayedKey, transitionPhase]);

  return { damagedKeys };
}

function useStageActionAnimations({
  align,
  displayedSprites,
  attackEvent,
  impactEvent,
  spriteRefs,
}: {
  align: "left" | "right";
  displayedSprites: StageSprite[];
  attackEvent?: BattleArenaActionEvent | null;
  impactEvent?: BattleArenaActionEvent | null;
  spriteRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const [impactBurstKeys, setImpactBurstKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!attackEvent || displayedSprites.length === 0) {
      return;
    }

    const leadSprite = displayedSprites[0];
    if (!leadSprite) {
      return;
    }

    const spriteNode = spriteRefs.current[leadSprite.alt];
    if (!spriteNode) {
      return;
    }

    const category = getMoveEffectCategory(attackEvent.moveId, attackEvent.moveType);
    const forward = align === "left" ? 24 : -24;

    spriteNode.animate(
      category === "pulse"
        ? [
            { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
            { transform: "translateX(0) scale(1.05)", filter: "brightness(1.22)" },
            { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
          ]
        : category === "shockwave"
          ? [
              { transform: "translateX(0) translateY(0) scale(1)", filter: "brightness(1)" },
              {
                transform: `translateX(${forward * 0.35}px) translateY(-6px) scale(1.04)`,
                filter: "brightness(1.08)",
              },
              {
                transform: `translateX(${forward}px) translateY(2px) scale(1.02)`,
                filter: "brightness(1.18)",
              },
              { transform: "translateX(0) translateY(0) scale(1)", filter: "brightness(1)" },
            ]
          : [
              { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
              { transform: `translateX(${forward}px) scale(1.04)`, filter: "brightness(1.14)" },
              {
                transform: `translateX(${forward * 0.45}px) scale(1.02)`,
                filter: "brightness(1.06)",
              },
              { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
            ],
      {
        duration: 380,
        easing: "ease-out",
      }
    );
  }, [align, attackEvent, displayedSprites]);

  useEffect(() => {
    if (!impactEvent || displayedSprites.length === 0) {
      return;
    }

    const leadSprite = displayedSprites[0];
    if (!leadSprite) {
      return;
    }

    setImpactBurstKeys((current) =>
      current.includes(leadSprite.alt) ? current : [...current, leadSprite.alt]
    );

    const spriteNode = spriteRefs.current[leadSprite.alt];
    if (spriteNode) {
      const recoil = align === "left" ? -14 : 14;
      spriteNode.animate(
        [
          { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
          { transform: `translateX(${recoil}px) scale(0.98)`, filter: "brightness(1.28)" },
          { transform: `translateX(${recoil * -0.55}px) scale(1.01)`, filter: "brightness(1.08)" },
          { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
        ],
        {
          duration: 320,
          easing: "ease-out",
        }
      );
    }

    const clearTimer = window.setTimeout(() => {
      setImpactBurstKeys((current) => current.filter((key) => key !== leadSprite.alt));
    }, 280);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [align, displayedSprites, impactEvent]);

  return { impactBurstKeys };
}

function useStagePokemonController({
  sprites,
  align,
  attackEvent,
  impactEvent,
}: {
  sprites?: StageSprite[];
  align: "left" | "right";
  attackEvent?: BattleArenaActionEvent | null;
  impactEvent?: BattleArenaActionEvent | null;
}) {
  const { activeSprites, activeSpriteKey, displayedKey, displayedSprites, transitionPhase } =
    useDisplayedStageSprites(sprites);
  const spriteRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { damagedKeys } = useStageDamageReaction({
    activeSprites,
    activeSpriteKey,
    displayedKey,
    align,
    transitionPhase,
    spriteRefs,
  });
  const { impactBurstKeys } = useStageActionAnimations({
    align,
    displayedSprites,
    attackEvent,
    impactEvent,
    spriteRefs,
  });

  return {
    displayedSprites,
    transitionPhase,
    damagedKeys,
    impactBurstKeys,
    spriteRefs,
  };
}

function StagePokemonSlot({
  sprites,
  boostEntries,
  statusEntries,
  align,
  attackEvent,
  impactEvent,
  previewMode = false,
}: {
  sprites?: StageSprite[];
  boostEntries?: Array<{
    species: string;
    boosts: Record<string, number>;
  }>;
  statusEntries?: Array<{
    species: string;
    status?: string | null;
  }>;
  align: "left" | "right";
  attackEvent?: BattleArenaActionEvent | null;
  impactEvent?: BattleArenaActionEvent | null;
  previewMode?: boolean;
}) {
  const { displayedSprites, transitionPhase, damagedKeys, impactBurstKeys, spriteRefs } =
    useStagePokemonController({
      sprites,
      align,
      attackEvent,
      impactEvent,
    });
  const spriteCount = displayedSprites.length;

  if (spriteCount === 0) {
    return null;
  }

  return (
    <StageSpriteAnchor align={align} spriteCount={spriteCount} previewMode={previewMode}>
      <StageSpriteVisual
        align={align}
        transitionPhase={transitionPhase}
        displayedSprites={displayedSprites}
        boostEntries={boostEntries}
        statusEntries={statusEntries}
        damagedKeys={damagedKeys}
        impactBurstKeys={impactBurstKeys}
        spriteRefs={spriteRefs}
      />
    </StageSpriteAnchor>
  );
}

export function BattleArena({
  title: _title,
  subtitle: _subtitle,
  status,
  formatLabel,
  topSide,
  bottomSide,
  actionEvent,
  previewMatchup,
  previewIntroState = "idle",
  className,
}: BattleArenaProps) {
  const isPreviewArena =
    (topSide.showMeter ?? true) === false &&
    (bottomSide.showMeter ?? true) === false &&
    (!topSide.moves || topSide.moves.length === 0) &&
    (!bottomSide.moves || bottomSide.moves.length === 0);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
      className
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#eef6ff_0%,#f4f8fd_40%,#e9f3df_40%,#eef7e5_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-border/80" />
        <div className="absolute inset-x-0 top-[40%] h-px bg-border/60" />
        <div
          className={cn(
            "relative h-full min-h-0 p-2 md:p-3 xl:p-4",
            isPreviewArena ? "pb-8 md:pb-10 xl:pb-12" : null
          )}
        >
          {isPreviewArena ? (
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 px-2 pt-6 md:px-3 md:pt-8 xl:px-4 xl:pt-10">
              <div className="flex items-start justify-end">
                <BattleArenaSideCard
                  side={topSide}
                  accent="sky"
                  align="right"
                  previewIntroState={previewIntroState}
                />
              </div>

              <div className="flex min-h-0 items-start justify-center pt-10 md:pt-12 xl:pt-14">
                <div className="relative w-full max-w-3xl">
                  <StageMoveEffectOverlay actionEvent={actionEvent} />
                  <StagePokemonSlot
                    sprites={bottomSide.activeSprites}
                    boostEntries={bottomSide.activeBoosts}
                    statusEntries={bottomSide.activeStatuses}
                    align="left"
                    attackEvent={actionEvent?.side === "p1" ? actionEvent : null}
                    impactEvent={actionEvent?.side === "p2" ? actionEvent : null}
                    previewMode
                  />
                  <StagePokemonSlot
                    sprites={topSide.activeSprites}
                    boostEntries={topSide.activeBoosts}
                    statusEntries={topSide.activeStatuses}
                    align="right"
                    attackEvent={actionEvent?.side === "p2" ? actionEvent : null}
                    impactEvent={actionEvent?.side === "p1" ? actionEvent : null}
                    previewMode
                  />
                  <PreviewMatchupLane
                    leftLabel={previewMatchup?.leftLabel ?? bottomSide.trainerName}
                    rightLabel={previewMatchup?.rightLabel ?? topSide.trainerName}
                    introState={previewIntroState}
                  />
                </div>
              </div>

              <div className="flex items-end justify-start">
                <BattleArenaSideCard
                  side={bottomSide}
                  accent="amber"
                  align="left"
                  previewIntroState={previewIntroState}
                />
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 px-2 pt-6 md:px-3 md:pt-8 xl:px-4 xl:pt-10">
              <div className="flex items-start justify-end">
                <BattleArenaSideCard side={topSide} accent="sky" align="right" />
              </div>

              <div className="flex min-h-0 items-start justify-center pt-10 md:pt-12 xl:pt-14">
                <div className="relative w-full max-w-3xl">
                  <StageMoveEffectOverlay actionEvent={actionEvent} />
                  <StagePokemonSlot
                    sprites={bottomSide.activeSprites}
                    boostEntries={bottomSide.activeBoosts}
                    statusEntries={bottomSide.activeStatuses}
                    align="left"
                    attackEvent={actionEvent?.side === "p1" ? actionEvent : null}
                    impactEvent={actionEvent?.side === "p2" ? actionEvent : null}
                  />
                  <StagePokemonSlot
                    sprites={topSide.activeSprites}
                    boostEntries={topSide.activeBoosts}
                    statusEntries={topSide.activeStatuses}
                    align="right"
                    attackEvent={actionEvent?.side === "p2" ? actionEvent : null}
                    impactEvent={actionEvent?.side === "p1" ? actionEvent : null}
                  />
                </div>
              </div>

              <div className="flex items-end justify-start">
                <BattleArenaSideCard side={bottomSide} accent="amber" align="left" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
