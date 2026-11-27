// `npm run dev:worktree` (plan V25 D-25-1, D-25-3, D-25-6): serves the app on a
// random free port with no argument or prompt, prints the URL and records the
// port in `.dev-port` once the server accepts connections. It runs no install
// (D-25-8).
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./free-port.mjs";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
const FATAL = ["uncaughtException", "unhandledRejection"];

/**
 * Registers cleanup on a process-like emitter: signals stop the child; a fatal
 * error also removes the port file and exits 1. Returns the uninstall function.
 */
export function installCleanup(run, proc = process) {
  const onSignal = () => run.stop();
  const onFatal = () => {
    run.stop();
    run.removePortFile();
    proc.exit(1);
  };
  for (const signal of SIGNALS) proc.on(signal, onSignal);
  for (const event of FATAL) proc.on(event, onFatal);
  return () => {
    for (const signal of SIGNALS) proc.off(signal, onSignal);
    for (const event of FATAL) proc.off(event, onFatal);
  };
}

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
  const removePortFile = () => {
    try {
      if (Number(readFileSync(portFile, "utf8").trim()) === port)
        rmSync(portFile, { force: true });
    } catch {}
  };
  const uninstall = installCleanup({ stop, removePortFile });
  const child = spawn(
    process.execPath,
    [viteEntry, "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
    { cwd, stdio: "inherit" },
  );
  const done = new Promise((resolve) => {
    const finish = (code) => {
      state.exited = true;
      uninstall();
      removePortFile();
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

/** Reads the Vite `base` from `vite.config.ts` in `appDir`, "/" when unset. */
export async function readViteBase(dir) {
  const { loadConfigFromFile } = await import("vite");
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    join(dir, "vite.config.ts"),
  );
  return loaded?.config.base ?? "/";
}

async function main() {
  const run = await startDevWorktree({
    appDir,
    base: await readViteBase(appDir),
  });
  process.exitCode = await run.done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
