import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  freePort,
  PREVIEW_PORT_ENV,
  sharedFreePort,
  TEST_PORT_ENV,
} from "./free-port.mjs";
import { installCleanup, readViteBase, startDevWorktree } from "./dev-worktree.mjs";

const listen = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
const close = (server) => new Promise((resolve) => server.close(resolve));

test("returns a valid port that can be bound at once", async () => {
  const port = await freePort();
  expect(Number.isInteger(port)).toBe(true);
  expect(port).toBeGreaterThan(0);
  expect(port).toBeLessThanOrEqual(65535);
  await close(await listen(port));
});

test("two calls while the first port is still held return different ports", async () => {
  const first = await freePort();
  const held = await listen(first);
  try {
    const second = await freePort();
    expect(second).not.toBe(first);
  } finally {
    await close(held);
  }
});

test("sharedFreePort draws once, stores the port in the environment and then reads it", async () => {
  const env = {};
  let draws = 0;
  const draw = async () => ++draws + 3000;
  expect(await sharedFreePort("PORT_A", env, draw)).toBe(3001);
  expect(env.PORT_A).toBe("3001");
  expect(await sharedFreePort("PORT_A", env, draw)).toBe(3001);
  expect(await sharedFreePort("PORT_B", env, draw)).toBe(3002);
  expect(draws).toBe(2);
});

const LISTEN_STUB = `
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { writeFileSync } from "node:fs";
const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
writeFileSync(process.env.STUB_ARGS ?? "args.json", JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
setTimeout(() => createServer().listen(port, () => {}), 200);
setTimeout(() => process.exit(0), 1500);
`;

const setup = (code) => {
  const dir = mkdtempSync(join(tmpdir(), "dev-worktree-"));
  const stub = join(dir, "stub-vite.mjs");
  writeFileSync(stub, code);
  return { dir, stub, portFile: join(dir, ".dev-port") };
};

test("dev-worktree passes flags and cwd, announces after listening, removes the port file on exit", async () => {
  const { dir, stub, portFile } = setup(LISTEN_STUB);
  const port = await freePort();
  const lines = [];
  const run = await startDevWorktree({
    appDir: dir,
    viteEntry: stub,
    portFile,
    base: "/base/",
    getPort: async () => port,
    log: (line) => lines.push(line),
    pollMs: 20,
  });
  expect(lines).toEqual([]);
  expect(existsSync(portFile)).toBe(false);
  expect(await run.ready).toBe(true);
  expect(lines.join("\n")).toContain(`http://localhost:${port}/base/`);
  expect(readFileSync(portFile, "utf8").trim()).toBe(String(port));
  expect(await run.done).toBe(0);
  expect(existsSync(portFile)).toBe(false);
  const args = JSON.parse(readFileSync(join(dir, "args.json"), "utf8"));
  expect(args.argv).toEqual([
    "--host",
    "0.0.0.0",
    "--port",
    String(port),
    "--strictPort",
  ]);
  expect(realpathSync(args.cwd)).toBe(realpathSync(dir));
});

test("dev-worktree never announces or writes a port file when Vite exits early", async () => {
  const { dir, stub, portFile } = setup("process.exit(2);\n");
  const lines = [];
  const run = await startDevWorktree({
    appDir: dir,
    viteEntry: stub,
    portFile,
    base: "/",
    getPort: async () => 4322,
    log: (line) => lines.push(line),
    pollMs: 20,
  });
  expect(await run.done).toBe(2);
  expect(await run.ready).toBe(false);
  expect(lines).toEqual([]);
  expect(existsSync(portFile)).toBe(false);
});

test("dev-worktree treats a stop it requested as a clean exit and removes the port file", async () => {
  const { dir, stub, portFile } = setup(
    LISTEN_STUB.replace("process.exit(0), 1500", "process.exit(0), 60000"),
  );
  const port = await freePort();
  const run = await startDevWorktree({
    appDir: dir,
    viteEntry: stub,
    portFile,
    base: "/",
    getPort: async () => port,
    log: () => {},
    pollMs: 20,
  });
  expect(await run.ready).toBe(true);
  run.stop();
  expect(await run.done).toBe(0);
  expect(existsSync(portFile)).toBe(false);
});

test("playwright.config.ts uses the env ports and keeps them distinct", async () => {
  const configUrl = new URL("../playwright.config.ts", import.meta.url).href;
  const load = async (test, preview, tag) => {
    process.env[TEST_PORT_ENV] = test;
    process.env[PREVIEW_PORT_ENV] = preview;
    const mod = await import(`${configUrl}?${tag}`);
    return mod.default.webServer.map((server) => new URL(server.url).port);
  };
  const saved = [process.env[TEST_PORT_ENV], process.env[PREVIEW_PORT_ENV]];
  try {
    expect(await load("41111", "42222", "distinct")).toEqual([
      "41111",
      "42222",
    ]);
    const [a, b] = await load("43333", "43333", "equal");
    expect(a).toBe("43333");
    expect(b).not.toBe(a);
  } finally {
    for (const [name, value] of [
      [TEST_PORT_ENV, saved[0]],
      [PREVIEW_PORT_ENV, saved[1]],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("readViteBase returns the base of the real vite config", async () => {
  const appDir = fileURLToPath(new URL("..", import.meta.url));
  expect(await readViteBase(appDir)).toBe("/dodge-hell-training/");
});

test("sharedFreePort redraws a pre-set value equal to an avoided port", async () => {
  const env = { A: "5000", B: "5000" };
  expect(await sharedFreePort("B", env, async () => 6000, [5000])).toBe(6000);
  expect(env.B).toBe("6000");
});

test("sharedFreePort redraws until the drawn port is not avoided", async () => {
  const seq = [5000, 5000, 5001];
  const env = {};
  expect(await sharedFreePort("B", env, async () => seq.shift(), [5000])).toBe(
    5001,
  );
});

test("dev-worktree overwrites a stale .dev-port, even one naming a live port, and keeps a file another process rewrote", async () => {
  const { dir, stub, portFile } = setup(
    LISTEN_STUB.replace("process.exit(0), 1500", "process.exit(0), 1000"),
  );
  const live = await listen(0);
  try {
    writeFileSync(portFile, `${live.address().port}\n`);
    const port = await freePort();
    const run = await startDevWorktree({
      appDir: dir,
      viteEntry: stub,
      portFile,
      base: "/",
      getPort: async () => port,
      log: () => {},
      pollMs: 20,
    });
    expect(await run.ready).toBe(true);
    expect(readFileSync(portFile, "utf8").trim()).toBe(String(port));
    writeFileSync(portFile, "1\n");
    expect(await run.done).toBe(0);
    expect(readFileSync(portFile, "utf8").trim()).toBe("1");
  } finally {
    await close(live);
  }
});

test("installCleanup stops on each signal, cleans up and exits 1 on fatal errors, and uninstalls", () => {
  for (const event of [
    "SIGINT",
    "SIGTERM",
    "SIGHUP",
    "uncaughtException",
    "unhandledRejection",
  ]) {
    const proc = new EventEmitter();
    proc.exit = (code) => calls.push(`exit${code}`);
    const calls = [];
    const uninstall = installCleanup(
      { stop: () => calls.push("stop"), removePortFile: () => calls.push("rm") },
      proc,
    );
    expect(proc.listenerCount(event)).toBe(1);
    proc.emit(event);
    expect(calls).toEqual(
      event.startsWith("SIG") ? ["stop"] : ["stop", "rm", "exit1"],
    );
    uninstall();
    expect(proc.eventNames()).toEqual([]);
  }
});

test("sharedFreePort replaces stored values that are not ports", async () => {
  for (const bad of ["abc", "0", "70000"]) {
    const env = { P: bad };
    expect(await sharedFreePort("P", env, async () => 3333)).toBe(3333);
    expect(env.P).toBe("3333");
  }
});
