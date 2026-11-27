// `npm run dev:worktree` (plan V25 D-25-1, D-25-3, D-25-6): serves the app on a
// random free port with no argument or prompt, prints the URL and records the
// port in `.dev-port` once the server accepts connections. It runs no install
// (D-25-8).
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./free-port.mjs";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

const accepts = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

/**
 * Starts Vite on a free port. Resolves after spawning with `ready` (true once
 * the port accepts connections and the URL is announced, false if Vite exits
 * first) and `done` (the exit code).
 */
export async function startDevWorktree({
  appDir: cwd,
  viteEntry = join(cwd, "node_modules/vite/bin/vite.js"),
  portFile = join(cwd, ".dev-port"),
  base,
  getPort = freePort,
  log = console.log,
  pollMs = 50,
}) {
  const port = await getPort();
  let stopping = false;
  const state = { exited: false };
  const stop = () => {
    stopping = true;
    child.kill("SIGTERM");
  };
  for (const signal of SIGNALS) process.on(signal, stop);
  const child = spawn(
    process.execPath,
    [viteEntry, "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
    { cwd, stdio: "inherit" },
  );
  const done = new Promise((resolve) => {
    const finish = (code) => {
      state.exited = true;
      for (const signal of SIGNALS) process.off(signal, stop);
      rmSync(portFile, { force: true });
      resolve(code);
    };
    child.once("error", () => finish(1));
    child.once("exit", (code) => finish(code ?? (stopping ? 0 : 1)));
  });
  const ready = (async () => {
    while (!state.exited) {
      if (await accepts(port)) {
        if (state.exited) return false;
        writeFileSync(portFile, `${port}\n`);
        log(`Dev server: http://localhost:${port}${base}`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return false;
  })();
  return { port, ready, done, stop };
}

async function main() {
  const { loadConfigFromFile } = await import("vite");
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    join(appDir, "vite.config.ts"),
  );
  const run = await startDevWorktree({ appDir, base: loaded?.config.base ?? "/" });
  process.exitCode = await run.done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
