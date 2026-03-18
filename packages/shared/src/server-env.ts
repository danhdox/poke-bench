import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const globalState = globalThis as typeof globalThis & {
  __pokeBenchServerEnvLoaded?: boolean;
};

export function ensureServerEnvLoaded() {
  if (globalState.__pokeBenchServerEnvLoaded) {
    return;
  }

  globalState.__pokeBenchServerEnvLoaded = true;

  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(sourceDir, "../../..");
  const envPath = join(repoRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  try {
    process.loadEnvFile(envPath);
  } catch {
    // Keep shell-provided env vars as-is if loading fails.
  }
}
