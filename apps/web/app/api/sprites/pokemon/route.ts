import { getPokemonSpriteMeta } from "@poke-bench/dex";
import { NextRequest, NextResponse } from "next/server";

const SHOWDOWN_FRONT_BASE = "https://play.pokemonshowdown.com/sprites/ani";
const SHOWDOWN_BACK_BASE = "https://play.pokemonshowdown.com/sprites/ani-back";

type PokeApiSprites = {
  front_default: string | null;
  back_default: string | null;
  other?: {
    showdown?: {
      front_default: string | null;
      back_default: string | null;
    } | null;
    home?: {
      front_default: string | null;
    } | null;
    ["official-artwork"]?: {
      front_default: string | null;
    } | null;
  } | null;
};

type PokeApiPokemon = {
  sprites: PokeApiSprites;
};

function normalizePokemonForPokeApi(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/['’.:]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getPokeApiCandidates(name: string) {
  const normalized = normalizePokemonForPokeApi(name);

  if (normalized.startsWith("tauros-paldea-") && !normalized.endsWith("-breed")) {
    return [`${normalized}-breed`, normalized];
  }

  if (normalized.startsWith("ogerpon-") && !normalized.endsWith("-mask")) {
    return [`${normalized}-mask`, normalized, "ogerpon"];
  }

  return [normalized];
}

function getPokeApiFallbackUrl(sprites: PokeApiSprites, perspective: "front" | "back") {
  const showdown = sprites.other?.showdown;
  if (perspective === "back") {
    return (
      showdown?.back_default ??
      showdown?.front_default ??
      sprites.back_default ??
      sprites.front_default ??
      sprites.other?.home?.front_default ??
      sprites.other?.["official-artwork"]?.front_default ??
      null
    );
  }

  return (
    showdown?.front_default ??
    sprites.front_default ??
    sprites.other?.home?.front_default ??
    sprites.other?.["official-artwork"]?.front_default ??
    showdown?.back_default ??
    sprites.back_default ??
    null
  );
}

async function resolvePokeApiSpriteUrl(name: string, perspective: "front" | "back") {
  for (const candidate of getPokeApiCandidates(name)) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${candidate}`, {
      next: { revalidate: 60 * 60 * 24 },
    }).catch(() => null);

    if (!response?.ok) {
      continue;
    }

    const payload = (await response.json()) as PokeApiPokemon;
    const spriteUrl = getPokeApiFallbackUrl(payload.sprites, perspective);
    if (spriteUrl) {
      return spriteUrl;
    }
  }

  return null;
}

function getSpritePlaceholder(label: string) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 24);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="24" fill="#f8fafc"/>
      <circle cx="80" cy="80" r="38" fill="#ffffff" stroke="#cbd5e1" stroke-width="6"/>
      <path d="M42 80h76" stroke="#cbd5e1" stroke-width="6"/>
      <circle cx="80" cy="80" r="10" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="4"/>
      <text x="80" y="138" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" fill="#64748b">${safeLabel}</text>
    </svg>
  `.trim();
}

export async function GET(request: NextRequest) {
  const species = request.nextUrl.searchParams.get("species")?.trim();
  const perspective = request.nextUrl.searchParams.get("perspective") === "back" ? "back" : "front";

  if (!species) {
    return new NextResponse("Missing species", { status: 400 });
  }

  const spriteMeta = getPokemonSpriteMeta(species);
  if (!spriteMeta) {
    return new NextResponse(getSpritePlaceholder(species), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const targetUrl =
    (await resolvePokeApiSpriteUrl(spriteMeta.name, perspective)) ??
    `${perspective === "back" ? SHOWDOWN_BACK_BASE : SHOWDOWN_FRONT_BASE}/${spriteMeta.spriteId}.gif`;

  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
