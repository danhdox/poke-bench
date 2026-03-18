"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { StatusPill } from "./status-pill";
import type { TeamPreviewMember } from "../lib/pokemon-sprites";
import { toPokemonId } from "../lib/pokemon-sprites";
import { Badge } from "@/components/ui/badge";
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
}: {
  side: BattleArenaSide;
  accent: "sky" | "amber";
  align: "left" | "right";
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
  const teamSlots = useMemo(
    () => Array.from({ length: 6 }, (_, index) => side.sprites?.[index] ?? null),
    [side.sprites]
  );
  const showMeter = side.showMeter ?? true;
  const isPreviewLayout = !showMeter && (!side.moves || side.moves.length === 0);
  const highlightedSpecies = useMemo(
    () => new Set(side.highlightedSpecies ?? []),
    [side.highlightedSpecies]
  );
  const highlightedMoves = useMemo(
    () => new Set(side.highlightedMoveIds ?? []),
    [side.highlightedMoveIds]
  );
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
            isSelected ? "border-primary/40 bg-accent" : null
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
        `rounded-xl border ${palette.border} ${palette.surface} p-3 shadow-sm`,
        "grid h-[19.25rem] w-[17rem] grid-rows-[auto_minmax(0,1fr)] sm:w-[17.75rem]"
      )}
    >
      <div className="space-y-1">
        <div className="text-base font-semibold text-foreground sm:text-lg">{side.activeLabel}</div>
        <Badge
          variant="secondary"
          className={cn("border text-xs font-medium shadow-none", palette.tag)}
        >
          {side.trainerName}
        </Badge>
      </div>
      <div className="min-h-0 overflow-hidden pt-3">
        {inspectedRoster ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] rounded-lg border bg-muted/10 p-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{inspectedRoster.species}</div>
              <div className={cn("mt-1 text-xs", palette.detail)}>
                {inspectedDex?.types.join(" / ") ?? "Loading typing..."}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
                <div className="text-xs text-muted-foreground">
                  Item
                </div>
                <div className="mt-1 truncate font-medium text-foreground">
                  {inspectedRoster.item ?? "None"}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
                <div className="text-xs text-muted-foreground">
                  Ability
                </div>
                <div className="mt-1 truncate font-medium text-foreground">
                  {inspectedRoster.ability ?? "Unknown"}
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
              {inspectedDex ? (
                <>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">HP</div>
                    <div className="font-semibold">{inspectedDex.baseStats.hp}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">Atk</div>
                    <div className="font-semibold">{inspectedDex.baseStats.atk}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">Def</div>
                    <div className="font-semibold">{inspectedDex.baseStats.def}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">SpA</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spa}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">SpD</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spd}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 px-2 py-1">
                    <div className="text-muted-foreground">Spe</div>
                    <div className="font-semibold">{inspectedDex.baseStats.spe}</div>
                  </div>
                </>
              ) : (
                <div className="col-span-3 rounded-md border bg-muted/20 px-2 py-1 text-muted-foreground">
                  Loading quick stats...
                </div>
              )}
            </div>
            <div className="mt-2 min-h-0 overflow-hidden">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Moves
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {inspectedRoster.moves.slice(0, 4).map((move) => (
                  <div
                    key={`${inspectedRoster.species}-${move}`}
                    className="truncate rounded-md border bg-muted/20 px-2 py-1.5 text-xs font-medium text-foreground"
                  >
                    {move}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
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
        `rounded-xl border ${palette.border} ${palette.surface} p-2 shadow-sm`
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

  return (
    <div className="absolute inset-0 z-20 overflow-visible pointer-events-none">
      <div
        ref={bannerRef}
        className={cn(
          "absolute left-1/2 top-1/2 rounded-md border bg-background/95 px-3 py-1 text-xs font-medium shadow-sm",
          palette.text
        )}
        style={{ borderColor: palette.glow }}
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

function StageSpriteAnchor({
  align,
  spriteCount,
  children,
}: {
  align: "left" | "right";
  spriteCount: number;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 pointer-events-none flex items-center overflow-visible",
        spriteCount > 1
          ? "h-24 w-32 md:h-28 md:w-40 xl:h-32 xl:w-44"
          : "h-28 w-28 md:h-32 md:w-32 xl:h-40 xl:w-40",
        align === "left"
          ? "bottom-0 left-[14%] translate-y-8 justify-start md:left-[16%] md:translate-y-10 xl:left-[18%] xl:translate-y-12"
          : "right-[14%] top-0 -translate-y-8 justify-end md:right-[16%] md:-translate-y-10 xl:right-[18%] xl:-translate-y-12"
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
  damagedKeys,
  impactBurstKeys,
  spriteRefs,
}: {
  align: "left" | "right";
  transitionPhase: "idle" | "recalling" | "sending";
  displayedSprites: StageSprite[];
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
  align,
  attackEvent,
  impactEvent,
}: {
  sprites?: StageSprite[];
  align: "left" | "right";
  attackEvent?: BattleArenaActionEvent | null;
  impactEvent?: BattleArenaActionEvent | null;
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
    <StageSpriteAnchor align={align} spriteCount={spriteCount}>
      <StageSpriteVisual
        align={align}
        transitionPhase={transitionPhase}
        displayedSprites={displayedSprites}
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
  className,
}: BattleArenaProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
      className
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f8fafc_44%,#f7f8f5_44%,#f7f8f5_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-border/80" />
        <div className="relative h-full min-h-0 p-2 md:p-3 xl:p-4">
          <div className="absolute right-2 top-2 z-10 flex flex-wrap items-center gap-2 md:right-3 md:top-3 xl:right-4 xl:top-4">
            <span className="rounded-md border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {formatLabel}
            </span>
            <StatusPill value={status} />
          </div>

          <div className="absolute right-2 top-10 md:right-3 md:top-11 xl:right-4 xl:top-12">
            <BattleArenaSideCard side={topSide} accent="sky" align="right" />
          </div>

          <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-center md:inset-x-3 xl:inset-x-4">
            <div className="relative mx-auto flex h-12 w-full max-w-3xl items-center justify-center rounded-lg border bg-background/70 md:h-14 xl:h-16">
              <StageMoveEffectOverlay actionEvent={actionEvent} />
              <StagePokemonSlot
                sprites={bottomSide.activeSprites}
                align="left"
                attackEvent={actionEvent?.side === "p1" ? actionEvent : null}
                impactEvent={actionEvent?.side === "p2" ? actionEvent : null}
              />
              <StagePokemonSlot
                sprites={topSide.activeSprites}
                align="right"
                attackEvent={actionEvent?.side === "p2" ? actionEvent : null}
                impactEvent={actionEvent?.side === "p1" ? actionEvent : null}
              />
              <div className="rounded-md border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                vs
              </div>
            </div>
          </div>

          <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 xl:bottom-4 xl:left-4">
            <BattleArenaSideCard side={bottomSide} accent="amber" align="left" />
          </div>
        </div>
      </div>
    </section>
  );
}
