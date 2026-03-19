import { getItem } from "@poke-bench/dex";
import { NextRequest, NextResponse } from "next/server";
import { normalizeItemId, normalizeItemSpriteSlug } from "../../../../lib/item-sprites";

type PokeApiItem = {
  sprites?: {
    default?: string | null;
  } | null;
};

const SHOWDOWN_ITEM_BASE = "https://play.pokemonshowdown.com/sprites/itemicons";

function getItemPlaceholder(label: string) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 20);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="#f8fafc"/>
      <rect x="24" y="28" width="48" height="40" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
      <path d="M32 34h32" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
      <path d="M36 46h24" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
      <text x="48" y="84" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b">${safeLabel}</text>
    </svg>
  `.trim();
}

async function canResolveSprite(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    next: { revalidate: 60 * 60 * 24 },
  }).catch(() => null);

  return Boolean(response?.ok);
}

async function resolveShowdownItemSprite(itemName: string) {
  const slug = normalizeItemSpriteSlug(itemName);
  const candidates = Array.from(new Set([slug, slug.replace(/-/g, "")]));

  for (const candidate of candidates) {
    const url = `${SHOWDOWN_ITEM_BASE}/${candidate}.png`;
    if (await canResolveSprite(url)) {
      return url;
    }
  }

  return null;
}

async function resolvePokeApiItemSprite(itemName: string) {
  const slug = normalizeItemSpriteSlug(itemName);
  const response = await fetch(`https://pokeapi.co/api/v2/item/${slug}`, {
    next: { revalidate: 60 * 60 * 24 },
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json()) as PokeApiItem;
  return payload.sprites?.default ?? null;
}

export async function GET(request: NextRequest) {
  const itemName = request.nextUrl.searchParams.get("item")?.trim();

  if (!itemName) {
    return new NextResponse("Missing item", { status: 400 });
  }

  const item = getItem(normalizeItemId(itemName));
  if (!item) {
    return new NextResponse(getItemPlaceholder(itemName), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const targetUrl =
    (await resolveShowdownItemSprite(item.name)) ?? (await resolvePokeApiItemSprite(item.name));

  if (!targetUrl) {
    return new NextResponse(getItemPlaceholder(item.name), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
