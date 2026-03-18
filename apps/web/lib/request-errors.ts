import { ZodError } from "zod";

export function formatRequestError(error: unknown, fallback = "Invalid request") {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) {
      return fallback;
    }

    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  }

  return error instanceof Error ? error.message : fallback;
}
