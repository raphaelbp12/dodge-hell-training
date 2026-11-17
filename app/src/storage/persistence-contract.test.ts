import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  AttemptHistory,
  HISTORY_SCHEMA_VERSION,
  HISTORY_STORAGE_KEY,
} from "./attempts";

/**
 * Plan V22 A14: a never-edited fixture per persisted history schema version
 * must still load into the current store, with no attempt lost.
 */

const FIXTURE_DIRECTORY = new URL("./__fixtures__/", import.meta.url);
const fixtureFiles = readdirSync(FIXTURE_DIRECTORY).filter((name) => /^attempts\.v\d+\.json$/.test(name));

function historyFrom(text: string): AttemptHistory {
  return new AttemptHistory(() => ({
    getItem: (key) => (key === HISTORY_STORAGE_KEY ? text : null),
    setItem: () => undefined,
  }));
}

describe("attempt history fixtures", () => {
  test("a fixture exists for every schema version up to the current one", () => {
    for (let version = 1; version <= HISTORY_SCHEMA_VERSION; version++)
      expect(fixtureFiles).toContain(`attempts.v${version}.json`);
  });

  test.each(fixtureFiles)("%s loads into the current store without losing an attempt", (name) => {
    const text = readFileSync(new URL(name, FIXTURE_DIRECTORY), "utf8");
    const stored = JSON.parse(text) as { records: { id: string }[] };
    const snapshot = historyFrom(text).snapshot();
    expect(snapshot.warning).toBeNull();
    expect(snapshot.records.map((record) => record.id)).toEqual(
      stored.records.map((record) => record.id),
    );
    expect(snapshot.records).toEqual(stored.records);
  });
});
