export type TeamFormatOption = {
  id: string;
  name: string;
};

export const SIMPLE_TEAM_FORMAT_IDS = [
  "gen9ou",
  "gen9vgc2024regg",
  "gen9vgc2026regi",
  "gen9doublesou",
  "gen9doublesubers",
] as const;

export const SIMPLE_TEAM_FORMAT_SET = new Set<string>(SIMPLE_TEAM_FORMAT_IDS);
export const PREFERRED_BATTLE_FORMAT_ID = "gen9ou";

export function getSimpleFormatName(name: string) {
  return name.replace(/^\[Gen \d+\]\s*/i, "");
}

export function filterSimpleTeamFormats<T extends TeamFormatOption>(formats: T[]) {
  return formats
    .filter((format) => SIMPLE_TEAM_FORMAT_SET.has(format.id))
    .map((format) => ({
      ...format,
      name: getSimpleFormatName(format.name),
    }));
}
