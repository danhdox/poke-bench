import Link from "next/link";
import {
  getAbility,
  getItem,
  getMove,
  getPokemon,
  searchDex,
} from "@poke-bench/dex";
import { PageScrollLock } from "../../components/page-scroll-lock";
import { ItemDisplay } from "../../components/item-display";
import { getPokemonSpriteUrl } from "../../lib/pokemon-sprites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  kind?: "pokemon" | "move" | "item" | "ability";
  q?: string;
  entry?: string;
}>;

const pokemonStats = [
  ["HP", "hp"],
  ["Atk", "atk"],
  ["Def", "def"],
  ["SpA", "spa"],
  ["SpD", "spd"],
  ["Spe", "spe"],
] as const;

function formatAbilitySlot(slot: string) {
  if (slot === "0") return "Primary";
  if (slot === "1") return "Secondary";
  if (slot === "H") return "Hidden";
  if (slot === "S") return "Special";
  return slot;
}

export default async function DexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const kind = params.kind ?? "pokemon";
  const q = params.q ?? "";
  const entry = params.entry ?? "";
  const results = searchDex(kind, q).slice(0, 120);
  const pokemonDetail = kind === "pokemon" ? getPokemon(entry) : null;
  const moveDetail = kind === "move" ? getMove(entry) : null;
  const itemDetail = kind === "item" ? getItem(entry) : null;
  const abilityDetail = kind === "ability" ? getAbility(entry) : null;
  const detail = pokemonDetail ?? moveDetail ?? itemDetail ?? abilityDetail;
  const pokemonAbilities = pokemonDetail
    ? Object.entries(pokemonDetail.abilities).map(([slot, ability]) => ({
        slot,
        name: ability,
        shortDesc: getAbility(ability)?.shortDesc ?? null,
      }))
    : [];

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100svh-var(--header-height)-1rem)]">
      <PageScrollLock />
      <div className="grid h-full min-h-0 flex-1 overflow-hidden rounded-b-[1.75rem] border-x border-b bg-card xl:grid-cols-[360px_minmax(0,1fr)] xl:items-stretch">
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-2xl font-semibold">Dex</h2>
          </div>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6">
            <form className="space-y-4 pb-5" action="/dex">
              <input type="hidden" name="kind" value={kind} />
              <div className="flex flex-wrap gap-2">
                {(["pokemon", "move", "item", "ability"] as const).map((value) => (
                  <Button
                    key={value}
                    asChild
                    size="sm"
                    variant={kind === value ? "secondary" : "outline"}
                  >
                    <Link href={`/dex?kind=${value}&q=${encodeURIComponent(q)}`}>{value}</Link>
                  </Button>
                ))}
              </div>
              <Input type="text" name="q" defaultValue={q} placeholder={`Search ${kind}`} />
              <Button type="submit">Search</Button>
            </form>

            <div className="h-0 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={`/dex?kind=${result.kind}&q=${encodeURIComponent(q)}&entry=${result.id}`}
                    className={`block rounded-lg border px-3 py-2 transition-colors ${
                      entry === result.id ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.kind === "pokemon" ? (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                          <img
                            src={getPokemonSpriteUrl(result.id, "front")}
                            alt={result.name}
                            className="size-10 object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : result.kind === "item" ? (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                          <ItemDisplay
                            itemName={result.name}
                            tooltipDescription={result.subtitle}
                            showName={false}
                            iconClassName="size-10 border-0 bg-transparent"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-medium">{result.name}</div>
                        {result.subtitle ? (
                          <div className="truncate text-xs text-muted-foreground">{result.subtitle}</div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-2xl font-semibold">{detail ? "Entry" : "Pick An Entry"}</h2>
          </div>
          <div className="h-0 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {detail ? (
              <div className="space-y-4">
                {pokemonDetail ? (
                  <div className="space-y-4">
                    <Card className="gap-0 py-0 shadow-none">
                      <CardContent className="px-6 py-6">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex size-36 shrink-0 items-center justify-center rounded-2xl border bg-background/80 xl:size-40">
                            <img
                              src={getPokemonSpriteUrl(pokemonDetail.id, "front")}
                              alt={pokemonDetail.name}
                              className="size-30 object-contain xl:size-34"
                              decoding="async"
                            />
                          </div>
                          <div className="flex size-36 shrink-0 items-center justify-center rounded-2xl border bg-background/60 xl:size-40">
                            <img
                              src={getPokemonSpriteUrl(pokemonDetail.id, "back")}
                              alt={`${pokemonDetail.name} back sprite`}
                              className="size-30 object-contain xl:size-34"
                              decoding="async"
                            />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-4xl font-semibold tracking-tight">
                              {pokemonDetail.name}
                            </div>
                            <div className="mt-2 text-base text-muted-foreground">
                              {pokemonDetail.types.join(" / ")}
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Entry ID
                              </div>
                              <div className="mt-1 font-medium">{pokemonDetail.id}</div>
                            </div>
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Base Stat Total
                              </div>
                              <div className="mt-1 font-medium">{pokemonDetail.bst}</div>
                            </div>
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Weight
                              </div>
                              <div className="mt-1 font-medium">{pokemonDetail.weightkg} kg</div>
                            </div>
                          </div>
                        </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                      <Card className="gap-0 py-0 shadow-none">
                        <CardHeader className="px-5 py-5">
                          <CardTitle className="text-lg">Base Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 pt-0">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {pokemonStats.map(([label, key]) => (
                            <div key={key} className="rounded-lg border bg-muted/20 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {label}
                              </div>
                              <div className="mt-1 text-2xl font-semibold">
                                {pokemonDetail.baseStats[key]}
                              </div>
                            </div>
                          ))}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <Card className="gap-0 py-0 shadow-none">
                          <CardHeader className="px-5 py-5">
                            <CardTitle className="text-lg">Abilities</CardTitle>
                          </CardHeader>
                          <CardContent className="px-5 pb-5 pt-0">
                            <div className="space-y-3">
                            {pokemonAbilities.map((ability) => (
                              <div key={ability.slot} className="rounded-lg border bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm text-muted-foreground">
                                    {formatAbilitySlot(ability.slot)}
                                  </div>
                                  <div className="text-right font-medium">{ability.name}</div>
                                </div>
                                {ability.shortDesc ? (
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {ability.shortDesc}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="gap-0 py-0 shadow-none">
                          <CardHeader className="px-5 py-5">
                            <CardTitle className="text-lg">Tags</CardTitle>
                          </CardHeader>
                          <CardContent className="px-5 pb-5 pt-0">
                          {pokemonDetail.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {pokemonDetail.tags.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No special tags.</p>
                          )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <details className="rounded-xl border bg-muted/10 p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        Raw Pokemon Data
                      </summary>
                      <pre className="mono mt-4 rounded-md border bg-muted/30 p-4 text-sm text-foreground">
                        {JSON.stringify(detail, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : null}

                {!pokemonDetail ? (
                  itemDetail ? (
                    <Card className="gap-0 py-0 shadow-none">
                      <CardContent className="px-6 py-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border bg-background/80">
                              <ItemDisplay
                                itemName={itemDetail.name}
                                tooltipDescription={itemDetail.shortDesc}
                                showName={false}
                                iconClassName="size-16 border-0 bg-transparent"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-3xl font-semibold tracking-tight">
                                {itemDetail.name}
                              </div>
                              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                {itemDetail.shortDesc}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Entry ID
                              </div>
                              <div className="mt-1 font-medium">{itemDetail.id}</div>
                            </div>
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Choice Item
                              </div>
                              <div className="mt-1 font-medium">{itemDetail.isChoice ? "Yes" : "No"}</div>
                            </div>
                            <div className="rounded-lg border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Berry
                              </div>
                              <div className="mt-1 font-medium">{itemDetail.isBerry ? "Yes" : "No"}</div>
                            </div>
                          </div>
                        </div>
                        {itemDetail.fling ? (
                          <div className="mt-5 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            Fling power: <span className="font-medium text-foreground">{itemDetail.fling.basePower}</span>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <pre className="mono rounded-md border bg-muted/30 p-4 text-sm text-foreground">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  )
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Search the simulator-backed Dex data for Pokemon, moves, items, or abilities. The
                data comes from the same rules ecosystem used by the battle simulator.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
