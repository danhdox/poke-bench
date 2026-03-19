import { toPokemonId } from "./pokemon-sprites";

export function normalizeItemId(item: string) {
  return toPokemonId(item);
}

export function normalizeItemSpriteSlug(item: string) {
  return item
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.:]/g, "")
    .replace(/♀|♂/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function getItemSpriteUrl(item: string) {
  const searchParams = new URLSearchParams({
    item,
  });
  return `/api/sprites/item?${searchParams.toString()}`;
}
