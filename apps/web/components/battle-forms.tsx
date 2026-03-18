"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BattleArena } from "./battle-arena";
import { StatusPill } from "./status-pill";
import { TeamForm } from "./team-form";
import { usePageScrollLock } from "./use-page-scroll-lock";
import type {
  BattleModelCatalogState,
  BattleModelOption,
} from "../lib/battle-setup";
import {
  extractTeamPreviewSpecies,
  getPokemonSpriteUrl,
  parseImportableTeam,
} from "../lib/pokemon-sprites";
import {
  filterSimpleTeamFormats,
  getSimpleFormatName,
  PREFERRED_BATTLE_FORMAT_ID,
  SIMPLE_TEAM_FORMAT_SET,
} from "../lib/team-formats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TeamOption = {
  id: string;
  name: string;
  importable?: string | null;
  formatId?: string | null;
  validationStatus?: string | null;
  validationErrors?: string | null;
};

type FormatOption = {
  id: string;
  name: string;
};

type BattleFormsProps = {
  models: BattleModelOption[];
  catalogStates: BattleModelCatalogState[];
  teams: TeamOption[];
  formats: FormatOption[];
};

function getDefaultFormatId(formats: FormatOption[]) {
  return (
    formats.find((format) => format.id === PREFERRED_BATTLE_FORMAT_ID)?.id ??
    formats[0]?.id ??
    ""
  );
}

function getTeamsForFormat(teams: TeamOption[], formatId: string) {
  return teams.filter((team) => team.formatId === formatId);
}

function getOptionName(options: Array<{ id: string; name: string }>, id: string, fallback: string) {
  return options.find((option) => option.id === id)?.name ?? fallback;
}

export function BattleForms({
  models,
  catalogStates,
  teams,
  formats,
}: BattleFormsProps) {
  usePageScrollLock();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [consoleView, setConsoleView] = useState<"setup" | "teams">("setup");

  const validTeams = useMemo(
    () =>
      teams.filter(
        (team) =>
          team.validationStatus === "valid" &&
          !!team.formatId &&
          SIMPLE_TEAM_FORMAT_SET.has(team.formatId)
      ),
    [teams]
  );
  const availableFormats = useMemo(() => {
    const validFormatIds = new Set(validTeams.map((team) => team.formatId));
    return filterSimpleTeamFormats(
      formats.filter((format) => validFormatIds.has(format.id))
    );
  }, [formats, validTeams]);
  const teamFormats = useMemo(() => filterSimpleTeamFormats(formats), [formats]);
  const defaultFormatId = getDefaultFormatId(availableFormats);
  const defaultTeams = getTeamsForFormat(validTeams, defaultFormatId);
  const [battleForm, setBattleForm] = useState(() => ({
    formatId: defaultFormatId,
    model1Key: models[0]?.key ?? "",
    model2Key: models[1]?.key ?? models[0]?.key ?? "",
    team1Id: defaultTeams[0]?.id ?? "",
    team2Id: defaultTeams[1]?.id ?? defaultTeams[0]?.id ?? "",
    maxTurns: "200",
  }));

  const teamsForSelectedFormat = useMemo(
    () => getTeamsForFormat(validTeams, battleForm.formatId),
    [battleForm.formatId, validTeams]
  );
  const savedTeams = useMemo(
    () =>
      [...validTeams].sort((left, right) => {
        if (left.formatId !== right.formatId) {
          return (left.formatId ?? "").localeCompare(right.formatId ?? "");
        }
        return left.name.localeCompare(right.name);
      }),
    [validTeams]
  );
  const selectedModel1 =
    models.find((model) => model.key === battleForm.model1Key) ?? null;
  const selectedModel2 =
    models.find((model) => model.key === battleForm.model2Key) ?? null;
  const selectedFormatName = getOptionName(
    availableFormats,
    battleForm.formatId,
    "Battle format"
  );
  const selectedTeam1Name = getOptionName(
    validTeams,
    battleForm.team1Id,
    "Team 1"
  );
  const selectedTeam2Name = getOptionName(
    validTeams,
    battleForm.team2Id,
    "Team 2"
  );

  const hasBattleRequirements =
    Boolean(selectedModel1) &&
    Boolean(selectedModel2) &&
    Boolean(battleForm.formatId) &&
    Boolean(battleForm.team1Id) &&
    Boolean(battleForm.team2Id);

  const setupWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (models.length === 0) {
      const providerMessages = catalogStates
        .filter((catalog) => catalog.status !== "ready")
        .map((catalog) =>
          catalog.status === "missing_key"
            ? `${catalog.providerLabel} is not configured in the repo-root .env.`
            : `${catalog.providerLabel} models are unavailable right now. ${catalog.error ?? ""}`.trim()
        );

      warnings.push(
        providerMessages.join(" ") ||
          "No supported live models are available with the current server configuration."
      );
    }

    if (availableFormats.length === 0) {
      warnings.push(
        "No valid team formats are available yet. Create or seed a valid team from the Teams panel."
      );
    } else if (teamsForSelectedFormat.length === 0) {
      warnings.push(
        "The selected format does not currently have any valid teams available."
      );
    }

    return warnings;
  }, [availableFormats.length, catalogStates, models.length, teamsForSelectedFormat.length]);

  const battlePreview = useMemo(() => {
    const team1Species = extractTeamPreviewSpecies(
      validTeams.find((team) => team.id === battleForm.team1Id)?.importable ?? ""
    );
    const team2Species = extractTeamPreviewSpecies(
      validTeams.find((team) => team.id === battleForm.team2Id)?.importable ?? ""
    );
    const team1Roster = parseImportableTeam(
      validTeams.find((team) => team.id === battleForm.team1Id)?.importable ?? ""
    );
    const team2Roster = parseImportableTeam(
      validTeams.find((team) => team.id === battleForm.team2Id)?.importable ?? ""
    );

    return {
      formatName: selectedFormatName,
      model1Name: selectedModel1?.name ?? "Model 1",
      model2Name: selectedModel2?.name ?? "Model 2",
      team1Name: selectedTeam1Name,
      team2Name: selectedTeam2Name,
      team1Species,
      team2Species,
      team1Roster,
      team2Roster,
    };
  }, [
    battleForm.team1Id,
    battleForm.team2Id,
    selectedFormatName,
    selectedModel1?.name,
    selectedModel2?.name,
    selectedTeam1Name,
    selectedTeam2Name,
    validTeams,
  ]);

  function updateFormat(formatId: string) {
    const nextTeams = getTeamsForFormat(validTeams, formatId);
    setBattleForm((current) => ({
      ...current,
      formatId,
      team1Id: nextTeams.some((team) => team.id === current.team1Id)
        ? current.team1Id
        : nextTeams[0]?.id ?? "",
      team2Id: nextTeams.some((team) => team.id === current.team2Id)
        ? current.team2Id
        : nextTeams[1]?.id ?? nextTeams[0]?.id ?? "",
    }));
  }

  function assignTeam(slot: "team1Id" | "team2Id", team: TeamOption) {
    const formatId = team.formatId ?? battleForm.formatId;
    const nextTeams = getTeamsForFormat(validTeams, formatId);
    setBattleForm((current) => ({
      ...current,
      formatId,
      team1Id:
        slot === "team1Id"
          ? team.id
          : nextTeams.some((entry) => entry.id === current.team1Id)
          ? current.team1Id
          : nextTeams[0]?.id ?? "",
      team2Id:
        slot === "team2Id"
          ? team.id
          : nextTeams.some((entry) => entry.id === current.team2Id)
          ? current.team2Id
          : nextTeams[1]?.id ?? nextTeams[0]?.id ?? "",
    }));
  }

  function submitBattle() {
    if (!selectedModel1 || !selectedModel2) {
      setError("Select two supported live models before starting a battle.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId: battleForm.formatId,
          model1: {
            provider: selectedModel1.provider,
            modelId: selectedModel1.modelId,
          },
          model2: {
            provider: selectedModel2.provider,
            modelId: selectedModel2.modelId,
          },
          team1Id: battleForm.team1Id,
          team2Id: battleForm.team2Id,
          maxTurns: Number(battleForm.maxTurns),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not create battle");
        return;
      }
      router.replace(`/battles/${payload.id}`);
    });
  }

  return (
    <div className="flex h-full min-h-0 max-h-full flex-1 overflow-hidden rounded-xl border bg-card">
      <div className="grid h-full min-h-0 max-h-full flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
        <div className="h-full min-h-0 overflow-hidden">
          <BattleArena
            className="h-full min-h-0"
            title={`${battlePreview.model1Name} vs ${battlePreview.model2Name}`}
            subtitle="Pokemon Showdown-style battle stage"
            status="preview"
            formatLabel={battlePreview.formatName}
            topSide={{
              trainerName: battlePreview.model2Name,
              teamName: battlePreview.team2Name,
              activeLabel:
                battlePreview.team2Species.length > 0
                  ? battlePreview.team2Name
                  : "Awaiting lead reveal",
              detail:
                battlePreview.team2Species.length > 0
                  ? ""
                  : `Team loaded: ${battlePreview.team2Name}`,
              showMeter: false,
              roster: battlePreview.team2Roster,
              sprites: battlePreview.team2Species.map((species) => ({
                url: getPokemonSpriteUrl(species, "front"),
                alt: species,
              })),
            }}
            bottomSide={{
              trainerName: battlePreview.model1Name,
              teamName: battlePreview.team1Name,
              activeLabel:
                battlePreview.team1Species.length > 0
                  ? battlePreview.team1Name
                  : "Awaiting lead reveal",
              detail:
                battlePreview.team1Species.length > 0
                  ? ""
                  : `Team loaded: ${battlePreview.team1Name}`,
              showMeter: false,
              roster: battlePreview.team1Roster,
              sprites: battlePreview.team1Species.map((species) => ({
                url: getPokemonSpriteUrl(species, "back"),
                alt: species,
              })),
            }}
          />
        </div>

        <section className="flex h-full min-h-0 max-h-full flex-col overflow-hidden border-t xl:border-t-0 xl:border-l">
          <div className="border-b px-5 py-5">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Battle Console</h2>
              <Tabs
                value={consoleView}
                onValueChange={(value) => setConsoleView(value as "setup" | "teams")}
                className="gap-0"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="setup">Setup</TabsTrigger>
                  <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="h-0 min-h-0 flex-1 overflow-hidden p-6">
            <Tabs
              value={consoleView}
              onValueChange={(value) => setConsoleView(value as "setup" | "teams")}
              className="h-full min-h-0 gap-0"
            >
              <TabsContent value="setup" className="mt-0 h-full min-h-0">
                <div className="flex h-full min-h-0 flex-col overflow-y-auto pr-1">
                <Card className="gap-0 py-0 shadow-none">
                  <CardHeader className="px-4 py-4">
                    <CardTitle className="text-sm">Setup</CardTitle>
                    <CardDescription>Pick a format, two models, and two teams.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 px-4 pb-4 pt-0">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={battleForm.formatId}
                      onValueChange={updateFormat}
                      disabled={availableFormats.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFormats.map((format) => (
                          <SelectItem key={format.id} value={format.id}>
                            {format.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Turns</Label>
                    <Input
                      type="number"
                      min="1"
                      value={battleForm.maxTurns}
                      onChange={(event) =>
                        setBattleForm((current) => ({
                          ...current,
                          maxTurns: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Model 1</Label>
                    <Select
                      value={battleForm.model1Key}
                      onValueChange={(value) =>
                        setBattleForm((current) => ({ ...current, model1Key: value }))
                      }
                      disabled={models.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.key} value={model.key}>
                            {model.providerLabel} · {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Model 2</Label>
                    <Select
                      value={battleForm.model2Key}
                      onValueChange={(value) =>
                        setBattleForm((current) => ({ ...current, model2Key: value }))
                      }
                      disabled={models.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.key} value={model.key}>
                            {model.providerLabel} · {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Team 1</Label>
                    <Select
                      value={battleForm.team1Id}
                      onValueChange={(value) =>
                        setBattleForm((current) => ({ ...current, team1Id: value }))
                      }
                      disabled={teamsForSelectedFormat.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamsForSelectedFormat.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Team 2</Label>
                    <Select
                      value={battleForm.team2Id}
                      onValueChange={(value) =>
                        setBattleForm((current) => ({ ...current, team2Id: value }))
                      }
                      disabled={teamsForSelectedFormat.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamsForSelectedFormat.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {setupWarnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {warning}
                  </div>
                ))}

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={submitBattle}
                    disabled={pending || !hasBattleRequirements}
                    className="w-full"
                  >
                    {pending ? "Starting..." : "Start Battle"}
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/benchmarks">View Benchmarks</Link>
                  </Button>
                </div>
                  </CardContent>
                </Card>
                </div>
              </TabsContent>

              <TabsContent value="teams" className="mt-0 h-full min-h-0">
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="h-0 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Team library</div>
                    <TeamForm
                      defaultFormatId={teamFormats[0]?.id ?? PREFERRED_BATTLE_FORMAT_ID}
                      formats={teamFormats}
                    />
                  </div>
                  <div className="space-y-3">
                    {savedTeams.map((team) => (
                      <Card key={team.id} className="gap-0 py-0 shadow-none">
                        <CardContent className="px-4 py-4">
                        {extractTeamPreviewSpecies(team.importable ?? "", 4).length > 0 ? (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {extractTeamPreviewSpecies(team.importable ?? "", 4).map(
                              (species) => (
                                <div
                                  key={`${team.id}-${species}`}
                                  className="flex size-12 items-center justify-center rounded-lg border bg-muted/20"
                                >
                                  <img
                                    src={getPokemonSpriteUrl(species, "front")}
                                    alt={species}
                                    className="size-10 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </div>
                              )
                            )}
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{team.name}</div>
                            <div className="truncate text-sm text-muted-foreground">
                              {getSimpleFormatName(
                                getOptionName(
                                  formats,
                                  team.formatId ?? "",
                                  team.formatId ?? "Unknown format"
                                )
                              )}
                            </div>
                            {team.validationErrors ? (
                              <div className="mt-1 text-xs text-destructive">
                                {team.validationErrors}
                              </div>
                            ) : null}
                          </div>
                          <StatusPill value={team.validationStatus ?? undefined} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => assignTeam("team1Id", team)}
                          >
                            Set Team 1
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => assignTeam("team2Id", team)}
                          >
                            Set Team 2
                          </Button>
                        </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </div>
  );
}
