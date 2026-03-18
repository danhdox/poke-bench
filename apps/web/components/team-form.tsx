"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { getPokemonSpriteUrl, parseImportableTeam } from "../lib/pokemon-sprites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type TeamFormProps = {
  defaultFormatId: string;
  formats: Array<{
    id: string;
    name: string;
  }>;
};

type PokemonSearchResult = {
  id: string;
  name: string;
  kind: "pokemon";
  subtitle?: string;
};

type DexPokemonEntry = {
  id: string;
  name: string;
  types: string[];
  abilities: Record<string, string>;
};

function getImportableBlocks(importable: string) {
  return importable
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getPaddedBlocks(importable: string) {
  const blocks = getImportableBlocks(importable);
  return Array.from({ length: 6 }, (_, index) => blocks[index] ?? "");
}

function joinBlocks(blocks: string[]) {
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildStarterBlock(species: string, dex?: DexPokemonEntry | null) {
  const defaultAbility = dex?.abilities["0"] ?? Object.values(dex?.abilities ?? {})[0] ?? "";
  const defaultTeraType = dex?.types[0] ?? "Normal";

  return [
    `${species} @ Leftovers`,
    `Ability: ${defaultAbility}`,
    `Tera Type: ${defaultTeraType}`,
    "EVs: 252 HP / 4 Def / 252 Spe",
    "Timid Nature",
    "- Move 1",
    "- Move 2",
    "- Move 3",
    "- Move 4",
  ].join("\n");
}

function replaceBlockSpecies(block: string, species: string, dex?: DexPokemonEntry | null) {
  if (!block.trim()) {
    return buildStarterBlock(species, dex);
  }

  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return buildStarterBlock(species, dex);
  }

  const currentHeader = lines[0] ?? species;
  const currentItem = currentHeader.includes("@") ? currentHeader.split("@")[1]?.trim() : "";
  lines[0] = currentItem ? `${species} @ ${currentItem}` : species;

  if (!lines.some((line) => line.toLowerCase().startsWith("ability:")) && dex) {
    lines.splice(1, 0, `Ability: ${dex.abilities["0"] ?? Object.values(dex.abilities)[0] ?? ""}`);
  }

  if (!lines.some((line) => line.toLowerCase().startsWith("tera type:"))) {
    lines.splice(2, 0, `Tera Type: ${dex?.types[0] ?? "Normal"}`);
  }

  return lines.join("\n");
}

export function TeamForm({ defaultFormatId, formats }: TeamFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState(defaultFormatId);
  const [importable, setImportable] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PokemonSearchResult[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [dexById, setDexById] = useState<Record<string, DexPokemonEntry>>({});
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const slotBlocks = useMemo(() => getPaddedBlocks(importable), [importable]);
  const slotMembers = useMemo(() => parseImportableTeam(importable, 6), [importable]);
  const selectedMember = slotMembers[selectedSlot] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setSearchPending(true);

    async function loadResults() {
      const response = await fetch(`/api/dex/pokemon?q=${encodeURIComponent(deferredSearchQuery)}`, {
        cache: "force-cache",
      });
      if (!response.ok || cancelled) {
        setSearchPending(false);
        return;
      }

      const payload = (await response.json()) as PokemonSearchResult[];
      if (cancelled) {
        return;
      }

      setSearchResults(payload.slice(0, 60));
      setSearchPending(false);
    }

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchQuery, open]);

  async function getDexEntry(id: string) {
    if (dexById[id]) {
      return dexById[id];
    }

    const response = await fetch(`/api/dex/pokemon/${id}`, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as DexPokemonEntry;
    setDexById((current) => ({
      ...current,
      [payload.id]: payload,
    }));
    return payload;
  }

  async function assignSpeciesToSlot(result: PokemonSearchResult) {
    const dexEntry = await getDexEntry(result.id);

    setImportable((current) => {
      const blocks = getPaddedBlocks(current);
      blocks[selectedSlot] = replaceBlockSpecies(blocks[selectedSlot], result.name, dexEntry);
      return joinBlocks(blocks);
    });

    setSelectedSlot((current) => {
      const nextEmptyIndex = slotBlocks.findIndex((block, index) => index > current && !block.trim());
      return nextEmptyIndex === -1 ? current : nextEmptyIndex;
    });
  }

  function clearSlot(slot: number) {
    setImportable((current) => {
      const blocks = getPaddedBlocks(current);
      blocks[slot] = "";
      return joinBlocks(blocks);
    });
    setResult(null);
    setError(null);
  }

  function resetDraft() {
    setName("");
    setFormatId(defaultFormatId);
    setImportable("");
    setSelectedSlot(0);
    setSearchQuery("");
    setResult(null);
    setError(null);
  }

  function validateOnly() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const response = await fetch("/api/teams/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatId, importable }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Validation failed");
        return;
      }
      setResult(payload.valid ? "Team is valid." : payload.errors.join("\n"));
    });
  }

  function save() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, formatId, importable }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Save failed");
        return;
      }

      resetDraft();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Plus />
          New Team
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full max-w-none gap-0 p-0 sm:max-w-[920px]">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Team Builder</SheetTitle>
          <SheetDescription>
            Pick six Pokemon from the sprite grid, then refine the generated Showdown importable
            before validating or saving.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b px-6 py-5 xl:border-r xl:border-b-0 xl:pr-5">
            <Card className="h-full shadow-none">
              <CardHeader className="gap-1">
                <CardTitle className="text-base">Slots</CardTitle>
                <CardDescription>
                  Select a slot, then choose a Pokemon from the sprite grid.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Team Name</Label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={formatId} onValueChange={setFormatId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {formats.map((format) => (
                          <SelectItem key={format.id} value={format.id}>
                            {format.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }, (_, index) => {
                    const member = slotMembers[index] ?? null;
                    const isSelected = selectedSlot === index;
                    return (
                      <button
                        key={`slot-${index}`}
                        type="button"
                        onClick={() => setSelectedSlot(index)}
                        className={`rounded-lg border p-2 text-left transition ${
                          isSelected
                            ? "border-primary/40 bg-accent"
                            : "border-border bg-card hover:bg-accent/60"
                        }`}
                      >
                        <div className="mb-2 text-xs text-muted-foreground">
                          Slot {index + 1}
                        </div>
                        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted/20">
                          {member ? (
                            <img
                              src={getPokemonSpriteUrl(member.species, "front")}
                              alt={member.species}
                              className="size-16 object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <Plus className="size-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="mt-2 truncate text-xs font-medium text-foreground">
                          {member?.species ?? "Empty slot"}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => clearSlot(selectedSlot)}
                    disabled={!slotBlocks[selectedSlot].trim()}
                  >
                    <Trash2 />
                    Clear selected slot
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <Card className="min-h-full shadow-none">
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Pokemon search</CardTitle>
                      <CardDescription>
                        Browse sprites, fill your slots, then refine the generated importable.
                      </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {searchPending ? "Loading..." : `${searchResults.length} results`}
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search Pokemon by name"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => void assignSpeciesToSlot(result)}
                        className="rounded-lg border bg-card p-3 text-left transition hover:bg-accent/60"
                      >
                        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted/15">
                          <img
                            src={getPokemonSpriteUrl(result.id, "front")}
                            alt={result.name}
                            className="size-18 object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="mt-3 font-medium text-foreground">{result.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {result.subtitle ?? "Pokemon"}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Showdown Importable</Label>
                      <div className="text-xs text-muted-foreground">
                        Starter blocks are generated from your slot picks. Edit before saving.
                      </div>
                    </div>
                    <Textarea
                      className="mono min-h-80"
                      value={importable}
                      onChange={(event) => setImportable(event.target.value)}
                    />
                  </div>

                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  {result ? (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result}</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="border-t px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={validateOnly} disabled={pending}>
                  Validate
                </Button>
                <Button type="button" onClick={save} disabled={pending || !name.trim() || !importable.trim()}>
                  Save Team
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
