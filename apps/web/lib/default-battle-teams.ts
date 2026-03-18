import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { prisma } from "@poke-bench/db";
import { validateTeam } from "@poke-bench/sim";

const DEFAULT_BATTLE_TEAMS = [
  {
    name: "Kingambit Balance",
    formatId: "gen9ou",
    fileName: "team3.txt",
    legacyNames: ["Tusk Gholdengo Balance"],
  },
  {
    name: "Gliscor Spikes",
    formatId: "gen9ou",
    fileName: "team4.txt",
    legacyNames: [],
  },
  {
    name: "Landorus Balance",
    formatId: "gen9vgc2024regg",
    fileName: "team1.txt",
    legacyNames: [],
  },
  {
    name: "Calyrex Shadow Mode",
    formatId: "gen9vgc2024regg",
    fileName: "team2.txt",
    legacyNames: [],
  },
] as const;

function getSampleTeamImportable(fileName: string) {
  const candidatePaths = [
    resolve(process.cwd(), "data/sample-teams", fileName),
    resolve(process.cwd(), "../data/sample-teams", fileName),
    resolve(process.cwd(), "../../data/sample-teams", fileName),
  ];

  const filePath = candidatePaths.find((candidate) => existsSync(candidate));
  if (!filePath) {
    throw new Error(
      `Default sample team is missing: ${fileName} (${candidatePaths.join(", ")})`
    );
  }
  return readFileSync(filePath, "utf8");
}

export async function ensureDefaultBattleTeams() {
  const existingTeams = await prisma.team.findMany({
    where: {
      OR: DEFAULT_BATTLE_TEAMS.flatMap((team) => [
        {
          name: team.name,
          formatId: team.formatId,
        },
        ...team.legacyNames.map((legacyName) => ({
          name: legacyName,
          formatId: team.formatId,
        })),
      ]),
    },
  });

  const existingByKey = new Map(
    existingTeams.map((team) => [`${team.name}:${team.formatId}`, team] as const)
  );

  await Promise.all(
    DEFAULT_BATTLE_TEAMS.map(async (team) => {
      const importable = getSampleTeamImportable(team.fileName);
      const validation = validateTeam(importable, team.formatId);
      const validationStatus = validation.valid ? "valid" : "invalid";
      const validationErrors = validation.valid ? null : validation.errors.join("\n");
      const existing =
        existingByKey.get(`${team.name}:${team.formatId}`) ??
        team.legacyNames
          .map((legacyName) => existingByKey.get(`${legacyName}:${team.formatId}`))
          .find(Boolean);

      if (
        existing &&
        existing.importable === importable &&
        existing.validationStatus === validationStatus &&
        existing.validationErrors === validationErrors
      ) {
        return;
      }

      if (existing) {
        await prisma.team.update({
          where: { id: existing.id },
          data: {
            name: team.name,
            importable,
            validationStatus,
            validationErrors,
          },
        });
        return;
      }

      await prisma.team.create({
        data: {
          name: team.name,
          formatId: team.formatId,
          importable,
          validationStatus,
          validationErrors,
        },
      });
    })
  );
}
