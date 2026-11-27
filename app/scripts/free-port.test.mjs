import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { freePort, PREVIEW_PORT_ENV, sharedFreePort, TEST_PORT_ENV } from "./free-port.mjs";
import { startDevWorktree } from "./dev-worktree.mjs";

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
  expect(args.argv).toEqual(["--host", "0.0.0.0", "--port", String(port), "--strictPort"]);
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

test("playwright.config.ts references the env names the helper exports", () => {
  const config = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");
  expect(config).toContain("TEST_PORT_ENV");
  expect(config).toContain("PREVIEW_PORT_ENV");
  expect(TEST_PORT_ENV).toBe("PLAYWRIGHT_TEST_PORT");
  expect(PREVIEW_PORT_ENV).toBe("PLAYWRIGHT_PREVIEW_PORT");
});

test("sharedFreePort replaces stored values that are not ports", async () => {
  for (const bad of ["abc", "0", "70000"]) {
    const env = { P: bad };
    expect(await sharedFreePort("P", env, async () => 3333)).toBe(3333);
    expect(env.P).toBe("3333");
  }
});
