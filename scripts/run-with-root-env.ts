import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const envPath = join(repoRoot, ".env");

if (typeof process.loadEnvFile === "function" && existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Fall back to the caller's current environment.
  }
}

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: tsx scripts/run-with-root-env.ts <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
