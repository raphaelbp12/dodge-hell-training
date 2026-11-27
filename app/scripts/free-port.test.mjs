import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { freePort, sharedFreePort } from "./free-port.mjs";
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

test("dev-worktree writes the port file while the server runs and removes it on exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-worktree-"));
  const stub = join(dir, "stub-vite.mjs");
  writeFileSync(stub, "setTimeout(() => {}, 300);\n");
  const portFile = join(dir, ".dev-port");
  const lines = [];
  const run = await startDevWorktree({
    appDir: dir,
    viteEntry: stub,
    portFile,
    base: "/base/",
    getPort: async () => 4321,
    log: (line) => lines.push(line),
  });
  expect(run.port).toBe(4321);
  expect(readFileSync(portFile, "utf8").trim()).toBe("4321");
  expect(lines.join("\n")).toContain("http://localhost:4321/base/");
  await run.done;
  expect(existsSync(portFile)).toBe(false);
});

test("dev-worktree removes the port file when the process is signalled", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-worktree-"));
  const stub = join(dir, "stub-vite.mjs");
  writeFileSync(stub, "setTimeout(() => {}, 60000);\n");
  const portFile = join(dir, ".dev-port");
  const run = await startDevWorktree({
    appDir: dir,
    viteEntry: stub,
    portFile,
    base: "/",
    getPort: async () => 4322,
    log: () => {},
  });
  expect(existsSync(portFile)).toBe(true);
  run.stop();
  await run.done;
  expect(existsSync(portFile)).toBe(false);
});

test("the script file is runnable by node (syntax check)", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/dev-worktree.mjs"]);
  expect(result.status).toBe(0);
});
