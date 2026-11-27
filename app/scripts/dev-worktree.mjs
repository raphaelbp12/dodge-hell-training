// `npm run dev:worktree` (plan V25 D-25-1, D-25-3, D-25-6): serves the app on a
// random free port with no argument or prompt, prints the URL and records the
// port in `.dev-port` while the server runs. It runs no install (D-25-8).
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./free-port.mjs";

const appDir = fileURLToPath(new URL("..", import.meta.url));

/** Starts Vite on a free port; resolves once the port file is written. */
export async function startDevWorktree({
  appDir: cwd,
  viteEntry = join(cwd, "node_modules/vite/bin/vite.js"),
  portFile = join(cwd, ".dev-port"),
  base,
  getPort = freePort,
  log = console.log,
}) {
  const port = await getPort();
  const child = spawn(
    process.execPath,
    [viteEntry, "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
    { cwd, stdio: "inherit" },
  );
  writeFileSync(portFile, `${port}\n`);
  log(`Dev server: http://localhost:${port}${base}`);
  const done = new Promise((resolve) => {
    child.once("exit", (code) => {
      rmSync(portFile, { force: true });
      resolve(code ?? 1);
    });
  });
  return { port, done, stop: () => child.kill("SIGTERM") };
}

async function main() {
  const { loadConfigFromFile } = await import("vite");
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    join(appDir, "vite.config.ts"),
  );
  const run = await startDevWorktree({ appDir, base: loaded?.config.base ?? "/" });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, run.stop);
  process.exitCode = await run.done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
