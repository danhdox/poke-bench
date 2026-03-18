import type { DexEntityKind, DexSearchResult } from "@poke-bench/shared";
import { Dex } from "@pkmn/sim";

function byQuery<T extends { id: string; name: string }>(items: readonly T[], q?: string) {
  const query = q?.trim().toLowerCase();
  if (!query) return items.slice(0, 200);
  return items.filter((item) => {
    return item.name.toLowerCase().includes(query) || item.id.includes(query);
  });
}

export function listFormats() {
  return Dex.formats
    .all()
    .filter(
      (format) =>
        (format.gameType === "doubles" || format.gameType === "singles") &&
        !format.section?.includes("Past")
    )
    .map((format) => ({
      id: format.id,
      name: format.name,
      gameType: format.gameType,
      ruleset: format.ruleset,
    }));
}

export function searchDex(kind: DexEntityKind, q?: string): DexSearchResult[] {
  switch (kind) {
    case "pokemon":
      return byQuery(Dex.species.all().filter((item) => item.exists), q).map((item) => ({
        id: item.id,
        name: item.name,
        kind,
        subtitle: item.types.join(" / "),
      }));
    case "move":
      return byQuery(Dex.moves.all().filter((item) => item.exists), q).map((item) => ({
        id: item.id,
        name: item.name,
        kind,
        subtitle: `${item.type} ${item.category} ${item.basePower || "-"}`,
      }));
    case "item":
      return byQuery(Dex.items.all().filter((item) => item.exists), q).map((item) => ({
        id: item.id,
        name: item.name,
        kind,
      }));
    case "ability":
      return byQuery(Dex.abilities.all().filter((item) => item.exists), q).map((item) => ({
        id: item.id,
        name: item.name,
        kind,
      }));
  }
}

export function getPokemon(id: string) {
  const species = Dex.species.get(id);
  if (!species.exists) return null;
  return {
    id: species.id,
    name: species.name,
    types: species.types,
    abilities: species.abilities,
    baseStats: species.baseStats,
    bst: species.bst,
    weightkg: species.weightkg,
    tags: species.tags,
  };
}

export function getPokemonSpriteMeta(id: string) {
  const species = Dex.species.get(id);
  if (!species.exists) return null;
  return {
    id: species.id,
    name: species.name,
    num: species.num,
    spriteId: species.spriteid,
  };
}

export function getMove(id: string) {
  const move = Dex.moves.get(id);
  if (!move.exists) return null;
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy,
    priority: move.priority,
    pp: move.pp,
    target: move.target,
    shortDesc: move.shortDesc,
    flags: Object.keys(move.flags ?? {}),
  };
}

export function getItem(id: string) {
  const item = Dex.items.get(id);
  if (!item.exists) return null;
  return {
    id: item.id,
    name: item.name,
    isBerry: item.isBerry,
    isChoice: item.isChoice ?? false,
    fling: item.fling,
    shortDesc: item.shortDesc,
  };
}

export function getAbility(id: string) {
  const ability = Dex.abilities.get(id);
  if (!ability.exists) return null;
  return {
    id: ability.id,
    name: ability.name,
    rating: ability.rating,
    shortDesc: ability.shortDesc,
  };
}
