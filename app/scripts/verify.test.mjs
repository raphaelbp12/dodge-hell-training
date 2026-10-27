import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const gates = ["lint", "typecheck", "test", "build"];
const preliminaryGates = gates.slice(0, 3);
const sourceScript = fileURLToPath(new URL("verify.mjs", import.meta.url));

function runCli({
  failureGate = "",
  outputLines = 3,
  singleLineLength = 0,
  missingNpm = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "quiet verify "));
  try {
    const appRoot = join(root, "app");
    const scriptsDirectory = join(appRoot, "scripts");
    const binDirectory = join(root, "bin");
    mkdirSync(scriptsDirectory, { recursive: true });
    mkdirSync(binDirectory, { recursive: true });
    const copiedScript = join(scriptsDirectory, "verify.mjs");
    copyFileSync(sourceScript, copiedScript);

    const callsPath = join(root, "calls.log");
    if (!missingNpm) {
      if (process.platform === "win32") {
        writeFileSync(
          join(binDirectory, "npm.cmd"),
          [
            "@echo off",
            'set "gate=%~2"',
            '>> "%VERIFY_TEST_CALLS%" echo %*',
            "for /L %%i in (1,1,%FAKE_OUTPUT_LINES%) do @echo fake %gate% line %%i",
            'if not "%FAKE_SINGLE_LINE_LENGTH%"=="0" "%VERIFY_TEST_NODE%" -e "process.stdout.write(\'x\'.repeat(Number(process.env.FAKE_SINGLE_LINE_LENGTH)))"',
            'if "%gate%"=="%FAKE_FAILURE_GATE%" exit /b 7',
            "exit /b 0",
            "",
          ].join("\r\n"),
        );
      } else {
        const fakeNpm = join(binDirectory, "npm");
        writeFileSync(
          fakeNpm,
          `#!/bin/sh
printf '%s\\n' "$*" >> "$VERIFY_TEST_CALLS"
i=1
while [ "$i" -le "$FAKE_OUTPUT_LINES" ]; do
  echo "fake $2 line $i"
  i=$((i + 1))
done
if [ "$FAKE_SINGLE_LINE_LENGTH" != "0" ]; then
  "$VERIFY_TEST_NODE" -e "process.stdout.write('x'.repeat(Number(process.env.FAKE_SINGLE_LINE_LENGTH)))"
fi
if [ "$2" = "$FAKE_FAILURE_GATE" ]; then exit 7; fi
exit 0
`,
        );
        chmodSync(fakeNpm, 0o755);
      }
    }

    const result = spawnSync(process.execPath, [copiedScript], {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: missingNpm
          ? binDirectory
          : `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
        VERIFY_TEST_CALLS: callsPath,
        VERIFY_TEST_NODE: process.execPath,
        FAKE_FAILURE_GATE: failureGate,
        FAKE_OUTPUT_LINES: String(outputLines),
        FAKE_SINGLE_LINE_LENGTH: String(singleLineLength),
      },
    });
    const calls = existsSync(callsPath)
      ? readFileSync(callsPath, "utf8").trim().split(/\r?\n/).filter(Boolean)
      : [];
    const logs = Object.fromEntries(
      gates.map((gate) => {
        const path = join(appRoot, "test-results", "verification", `${gate}.log`);
        return [gate, existsSync(path) ? readFileSync(path, "utf8") : undefined];
      }),
    );
    return { result, calls, logs };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("runs all gates quietly and writes complete logs", () => {
  const { result, calls, logs } = runCli();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls, gates.map((gate) => `run ${gate}`));
  const passLines = result.stdout
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.startsWith("PASS "));
  assert.equal(passLines.length, 4);
  for (const gate of gates) {
    assert.match(result.stdout, new RegExp(`PASS ${gate}\\b`));
    assert.match(logs[gate], new RegExp(`fake ${gate} line 3`));
  }
});

for (const failureGate of preliminaryGates) {
  test(`continues after ${failureGate} failure and skips build`, () => {
    const { result, calls, logs } = runCli({ failureGate });
    assert.notEqual(result.status, 0);
    assert.deepEqual(calls, preliminaryGates.map((gate) => `run ${gate}`));
    assert.match(result.stderr, new RegExp(`FAIL ${failureGate}\\b`));
    assert.match(result.stdout, /SKIP build/);
    assert.equal(logs.build, undefined);
    for (const gate of preliminaryGates.filter((gate) => gate !== failureGate)) {
      assert.match(result.stdout, new RegExp(`PASS ${gate}\\b`));
    }
  });
}

test("bounds failure excerpts without truncating logs", () => {
  const { result, logs } = runCli({ failureGate: "test", outputLines: 200 });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /fake test line 1\r?$/m);
  assert.match(result.stderr, /fake test line 200/);
  assert.ok(result.stderr.trim().split(/\r?\n/).length <= 82);
  assert.equal(logs.test.trim().split(/\r?\n/).length, 200);
  assert.match(logs.test, /fake test line 1\r?$/m);
  assert.match(logs.test, /fake test line 200/);
});

test("bounds a large single-line failure without truncating its log", () => {
  const { result, logs } = runCli({
    failureGate: "lint",
    outputLines: 0,
    singleLineLength: 200_000,
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.length < 20_000);
  assert.equal(logs.lint.length, 200_000);
});

test("reports a missing npm executable and still attempts preliminary gates", () => {
  const { result, calls } = runCli({ missingNpm: true });
  assert.notEqual(result.status, 0);
  assert.deepEqual(calls, []);
  for (const gate of preliminaryGates) {
    assert.match(result.stderr, new RegExp(`FAIL ${gate}\\b`));
  }
  assert.match(result.stderr, /ENOENT|not found|not recognized|spawn/i);
  assert.match(result.stdout, /SKIP build/);
});
