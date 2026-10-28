import { expect, test, vi } from "vitest";
import { ENCOUNTER_CONFIG, RULES_VERSION } from "../game/config/encounter";
import {
  AttemptHistory,
  HISTORY_STORAGE_KEY,
  HISTORY_SCHEMA_VERSION,
  retainedBestSeconds,
  type AttemptRecord,
} from "./attempts";

function record(
  id = "attempt-1",
  elapsedSeconds = 12.25,
  rulesVersion = RULES_VERSION,
): AttemptRecord {
  return { id, rulesVersion, elapsedSeconds, hitsTaken: 7, outcome: "death" };
}

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  };
}

function encoded(records: unknown[], schemaVersion = HISTORY_SCHEMA_VERSION) {
  return JSON.stringify({ schemaVersion, records });
}

test("loads empty storage without requiring browser globals", () => {
  const boundary = storage();
  const history = new AttemptHistory(() => boundary);
  expect(history.snapshot()).toEqual({ records: [], warning: null });
  expect(boundary.getItem).toHaveBeenCalledWith(HISTORY_STORAGE_KEY);
  expect(boundary.setItem).not.toHaveBeenCalled();
  expect(typeof window).toBe("undefined");
});

test("saves versioned death records, deduplicates by identity, and survives reload", () => {
  const boundary = storage();
  const history = new AttemptHistory(() => boundary);
  history.save(record());
  history.save(record());
  expect(boundary.setItem).toHaveBeenCalledTimes(1);
  expect(JSON.parse(boundary.getItem()!)).toEqual({
    schemaVersion: HISTORY_SCHEMA_VERSION,
    records: [record()],
  });
  const refreshed = new AttemptHistory(() => boundary);
  refreshed.save(record());
  expect(boundary.setItem).toHaveBeenCalledTimes(1);
  refreshed.save(record("new-runtime-attempt-1", 13));
  expect(refreshed.snapshot().records).toEqual([
    record("new-runtime-attempt-1", 13),
    record(),
  ]);
});

test("retains the latest configured 100 deaths across all rules and derives best only from retained compatible records", () => {
  const history = new AttemptHistory(() => storage());
  history.save(record("old-best", 999));
  for (let index = 0; index < ENCOUNTER_CONFIG.session.historyLimit; index++) {
    history.save(
      record(
        `attempt-${index}`,
        index,
        index % 2 ? RULES_VERSION : "other-rules",
      ),
    );
  }
  const { records } = history.snapshot();
  expect(records).toHaveLength(100);
  expect(records[0]?.id).toBe("attempt-99");
  expect(records.some((entry) => entry.id === "old-best")).toBe(false);
  expect(retainedBestSeconds(records, RULES_VERSION)).toBe(99);
  expect(retainedBestSeconds(records, "other-rules")).toBe(98);
  expect(retainedBestSeconds(records, "unknown-rules")).toBeNull();
});

test("step 23.1: saves and reloads a cleared (win) outcome alongside death records", () => {
  const boundary = storage();
  const history = new AttemptHistory(() => boundary);
  const cleared: AttemptRecord = { ...record("win-1"), outcome: "cleared" };
  history.save(cleared);
  history.save(record("death-1", 5));
  const refreshed = new AttemptHistory(() => boundary);
  expect(refreshed.snapshot().records).toEqual([record("death-1", 5), cleared]);
});

test("retains v2 scores without comparing them to selected v3 defaults", () => {
  const legacy = record("v2-best", 999, "crystal-worm-child-head-paladin-v2");
  const boundary = storage(encoded([legacy]));
  const history = new AttemptHistory(() => boundary);
  expect(history.snapshot().records).toEqual([legacy]);
  expect(
    retainedBestSeconds(history.snapshot().records, RULES_VERSION),
  ).toBeNull();
  history.save(record("v3-best", 12));
  expect(retainedBestSeconds(history.snapshot().records, RULES_VERSION)).toBe(
    12,
  );
  expect(history.snapshot().records).toContainEqual(legacy);
});

test("bounds oversized loaded history, removes duplicate IDs, and preserves newer-first order", () => {
  const entries = Array.from({ length: 102 }, (_, index) =>
    record(`id-${index}`, index),
  );
  const history = new AttemptHistory(() =>
    storage(encoded([entries[0], ...entries])),
  );
  expect(history.snapshot().records).toEqual(entries.slice(0, 100));
});

test.each([
  "{",
  "null",
  "[]",
  "{}",
  encoded([], 99),
  JSON.stringify({ schemaVersion: "1", records: [] }),
  JSON.stringify({ schemaVersion: 1, records: {} }),
  encoded([null]),
  encoded([42]),
  ...[
    { id: "" },
    { rulesVersion: " " },
    { outcome: "abort" },
    { elapsedSeconds: -1 },
    { elapsedSeconds: "12" },
    { elapsedSeconds: null },
    { hitsTaken: -1 },
    { hitsTaken: 1.5 },
    { hitsTaken: Number.MAX_SAFE_INTEGER + 1 },
  ].map((invalid) => encoded([{ ...record(), ...invalid }])),
])(
  "rejects malformed/unrecognized storage without overwriting it: %s",
  (initial) => {
    const boundary = storage(initial);
    const history = new AttemptHistory(() => boundary);
    expect(history.snapshot().records).toEqual([]);
    expect(history.snapshot().warning).not.toBeNull();
    history.save(record());
    expect(history.snapshot().records).toEqual([record()]);
    expect(boundary.setItem).not.toHaveBeenCalled();
    expect(boundary.getItem()).toBe(initial);
  },
);

test("unavailable storage getter and blocked reads keep practice records in memory", () => {
  for (const getStorage of [
    () => {
      throw new Error("SecurityError");
    },
    () => ({
      getItem: () => {
        throw new Error("blocked read");
      },
      setItem: vi.fn(),
    }),
  ]) {
    const history = new AttemptHistory(getStorage);
    history.save(record());
    expect(history.snapshot().records).toEqual([record()]);
    expect(history.snapshot().warning).not.toBeNull();
  }
});

test("quota failures retain current and later results in memory without repeated failed writes", () => {
  const boundary = storage(encoded([record("prior")]));
  boundary.setItem.mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  const history = new AttemptHistory(() => boundary);
  history.save(record());
  history.save(record("later"));
  expect(history.snapshot().records.map((entry) => entry.id)).toEqual([
    "later",
    "attempt-1",
    "prior",
  ]);
  expect(history.snapshot().warning).not.toBeNull();
  expect(boundary.setItem).toHaveBeenCalledTimes(1);
});

test("snapshots own immutable copies rather than allowing callers to mutate saved records", () => {
  const history = new AttemptHistory(() => storage());
  const input = record();
  history.save(input);
  expect(history.snapshot().records[0]).not.toBe(input);
  expect(Object.isFrozen(history.snapshot().records)).toBe(true);
  expect(Object.isFrozen(history.snapshot().records[0])).toBe(true);
});
