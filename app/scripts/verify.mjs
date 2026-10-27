#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const logDirectory = join(appRoot, "test-results", "verification");
const isWindows = process.platform === "win32";
// Node rejects direct .cmd execution on Windows; explicit cmd.exe invocation
// keeps the fixed gate arguments separate and works when the app path has spaces.
const npmCommand = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = (gate) =>
  isWindows ? ["/d", "/s", "/c", "npm.cmd", "run", gate] : ["run", gate];
// Equivalent to --silent: hides npm's "npm notice run …" lines from gate logs.
const npmEnvironment = { ...process.env, npm_config_loglevel: "silent" };
const preliminaryGates = ["lint", "typecheck", "test"];
const failureExcerptLines = 80;
const failureExcerptMaxBytes = 16 * 1024;

mkdirSync(logDirectory, { recursive: true });

function readFailureExcerpt(logPath) {
  const size = statSync(logPath).size;
  const length = Math.min(size, failureExcerptMaxBytes);
  const buffer = Buffer.alloc(length);
  const descriptor = openSync(logPath, "r");
  let bytesRead;
  try {
    bytesRead = readSync(descriptor, buffer, 0, length, size - length);
  } finally {
    closeSync(descriptor);
  }
  const lines = buffer
    .subarray(0, bytesRead)
    .toString("utf8")
    .trimEnd()
    .split(/\r?\n/);
  // A tail read that starts mid-file may begin inside a line or UTF-8 character.
  if (length < size && lines.length > 1) lines.shift();
  return lines.slice(-failureExcerptLines).join("\n");
}

function runGate(gate) {
  const logPath = join(logDirectory, `${gate}.log`);
  const descriptor = openSync(logPath, "w");
  let result;
  try {
    result = spawnSync(npmCommand, npmArguments(gate), {
      cwd: appRoot,
      env: npmEnvironment,
      stdio: ["ignore", descriptor, descriptor],
    });
  } finally {
    closeSync(descriptor);
  }
  if (result.error) {
    appendFileSync(logPath, `\n${result.error.stack ?? result.error.message}\n`);
  }
  const passed = !result.error && result.status === 0;
  const relativeLogPath = `test-results/verification/${gate}.log`;
  console[passed ? "log" : "error"](
    `${passed ? "PASS" : "FAIL"} ${gate} — ${relativeLogPath}`,
  );
  if (!passed) console.error(readFailureExcerpt(logPath));
  return passed;
}

let failed = false;
for (const gate of preliminaryGates) {
  if (!runGate(gate)) failed = true;
}
if (failed) {
  // Remove the previous build log so it cannot be mistaken for this run's result.
  rmSync(join(logDirectory, "build.log"), { force: true });
  console.log("SKIP build — a preliminary gate failed");
} else if (!runGate("build")) {
  failed = true;
}

process.exitCode = failed ? 1 : 0;
