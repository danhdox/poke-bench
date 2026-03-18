export type TeamPreviewMember = {
  species: string;
  item: string | null;
  ability: string | null;
  teraType: string | null;
  nature: string | null;
  moves: string[];
};

export function getPokemonSpriteUrl(species: string, perspective: "front" | "back" = "front") {
  const searchParams = new URLSearchParams({
    species,
    perspective,
  });
  return `/api/sprites/pokemon?${searchParams.toString()}`;
}

export function toPokemonId(species: string) {
  return species.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function reconcileSpeciesWithPreview(species: string, previewSpecies: string[]) {
  const normalizedSpecies = toPokemonId(species);
  if (!normalizedSpecies) {
    return species;
  }

  const exactMatch = previewSpecies.find(
    (preview) => toPokemonId(preview) === normalizedSpecies
  );
  if (exactMatch) {
    return exactMatch;
  }

  const fuzzyMatch = previewSpecies.find((preview) => {
    const normalizedPreview = toPokemonId(preview);
    return (
      normalizedPreview.startsWith(normalizedSpecies) ||
      normalizedSpecies.startsWith(normalizedPreview)
    );
  });

  return fuzzyMatch ?? species;
}

export function parseImportableTeam(importable: string, limit = 6): TeamPreviewMember[] {
  return importable
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const header = lines[0] ?? "";
      const base = header.split("@")[0]?.trim() ?? "";
      const speciesFromParens = base.match(/\(([^()]+)\)\s*$/)?.[1];
      const species = (speciesFromParens ?? base).replace(/\s+\((M|F)\)\s*$/i, "").trim();
      const item = header.includes("@") ? header.split("@")[1]?.trim() ?? null : null;
      const ability =
        lines.find((line) => line.toLowerCase().startsWith("ability:"))?.split(":")[1]?.trim() ??
        null;
      const teraType =
        lines.find((line) => line.toLowerCase().startsWith("tera type:"))?.split(":")[1]?.trim() ??
        null;
      const nature =
        lines.find((line) => /nature$/i.test(line) && !line.includes(":"))?.replace(/\s*nature$/i, "").trim() ??
        null;
      const moves = lines
        .filter((line) => line.startsWith("-"))
        .map((line) => line.replace(/^-+\s*/, "").trim())
        .filter(Boolean);

      return {
        species,
        item,
        ability,
        teraType,
        nature,
        moves,
      };
    });
}

export function extractTeamPreviewSpecies(importable: string, limit = 6) {
  return parseImportableTeam(importable, limit).map((member) => member.species);
}
