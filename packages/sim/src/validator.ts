import { TeamValidator, Teams } from "@pkmn/sim";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTeam(teamText: string, formatId: string): ValidationResult {
  try {
    const team = Teams.import(teamText);
    if (!team || team.length === 0) {
      return { valid: false, errors: ["Could not parse team"] };
    }

    const validator = new TeamValidator(formatId);
    const problems = validator.validateTeam(team);

    if (problems && problems.length > 0) {
      return { valid: false, errors: problems };
    }

    return { valid: true, errors: [] };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}
