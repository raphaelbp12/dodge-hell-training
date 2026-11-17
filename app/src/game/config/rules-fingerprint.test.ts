import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import arenaData from "../data/arena.json";
import encounterData from "../data/encounter.json";
import projectilesData from "../data/projectiles.json";
import shapesData from "../data/shapes.json";
import stored from "./rules-fingerprint.json";

/**
 * Plan V22 A12: a hash of the gameplay inputs each encounter consumes, tied to
 * its `rulesVersion`. A change to gameplay data without a version bump, or a
 * bump without refreshing this file, fails here. The test never writes the
 * file: a failure prints the new entry to copy.
 */

const ENEMY_FILES = import.meta.glob("../data/enemies/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/**
 * Keys excluded from the hash because they never change gameplay:
 * - `comment` and `source`: provenance prose;
 * - `appearance`: the sprite a projectile is drawn with (presentation only);
 * - `telegraphColor`: the colour a phase telegraph is drawn in;
 * - `displayName`: the Home screen label.
 */
const PRESENTATION_ONLY_KEYS: ReadonlySet<string> = new Set([
  "comment",
  "source",
  "appearance",
  "telegraphColor",
  "displayName",
]);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Keys sorted recursively, arrays in authored order, presentation-only keys dropped. */
function canonical(value: unknown): Json {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !PRESENTATION_ONLY_KEYS.has(key))
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  return value as Json;
}

export type GameplayData = Readonly<{
  encounter: typeof encounterData;
  arenas: typeof arenaData;
  shapes: typeof shapesData;
  projectiles: typeof projectilesData;
  enemies: Record<string, unknown>;
}>;

const SHIPPED: GameplayData = {
  encounter: encounterData,
  arenas: arenaData,
  shapes: shapesData,
  projectiles: projectilesData,
  enemies: Object.fromEntries(
    Object.entries(ENEMY_FILES).map(([path, value]) => [
      /\/([a-z0-9-]+)\.json$/.exec(path)?.[1] ?? path,
      value,
    ]),
  ),
};

/** Every value stored under `key` anywhere in `node`. */
function valuesOfKey(node: unknown, key: string): string[] {
  if (Array.isArray(node)) return node.flatMap((child) => valuesOfKey(child, key));
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([name, child]) =>
    name === key && typeof child === "string" ? [child] : valuesOfKey(child, key),
  );
}

/** The archetypes an encounter can field: its primary and spawn archetypes and everything they spawn. */
function reachableArchetypes(data: GameplayData, encounterId: string): string[] {
  const entry = (data.encounter.encounters as Record<string, { primaryArchetype: string; spawns: { archetype: string } }>)[
    encounterId
  ];
  const queue = [entry.primaryArchetype, entry.spawns.archetype];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...valuesOfKey(data.enemies[id], "archetype"));
  }
  return [...seen].sort();
}

/** SHA-256 of the canonical gameplay input of one encounter. */
export function gameplayHash(data: GameplayData, encounterId: string): string {
  const entries = data.encounter.encounters as Record<string, { arenaId: string }>;
  const archetypeIds = reachableArchetypes(data, encounterId);
  const projectileIds = [
    ...new Set(archetypeIds.flatMap((id) => valuesOfKey(data.enemies[id], "projectile"))),
  ].sort();
  const input = {
    encounter: entries[encounterId],
    shared: {
      simulation: data.encounter.simulation,
      player: data.encounter.player,
      maxConcurrentMinions: data.encounter.maxConcurrentMinions,
    },
    arena: (data.arenas.arenas as Record<string, unknown>)[entries[encounterId].arenaId],
    shapes: data.shapes.shapes,
    archetypes: Object.fromEntries(archetypeIds.map((id) => [id, data.enemies[id]])),
    projectiles: Object.fromEntries(
      projectileIds.map((id) => [
        id,
        (data.projectiles.projectiles as Record<string, unknown>)[id],
      ]),
    ),
  };
  return createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
}

type Fingerprint = Readonly<Record<string, Readonly<{ rulesVersion: string; sha256: string }>>>;

/** The failure message for one encounter, or null when its fingerprint is current. */
export function fingerprintProblem(
  data: GameplayData,
  encounterId: string,
  fingerprint: Fingerprint,
): string | null {
  const entries = data.encounter.encounters as Record<string, { rulesVersion: string }>;
  const { rulesVersion } = entries[encounterId];
  const sha256 = gameplayHash(data, encounterId);
  const recorded = fingerprint[encounterId];
  const entry = JSON.stringify({ [encounterId]: { rulesVersion, sha256 } }, null, 2);
  if (!recorded) return `${encounterId} has no fingerprint entry. Add:\n${entry}`;
  if (recorded.sha256 === sha256 && recorded.rulesVersion === rulesVersion) return null;
  if (recorded.rulesVersion === rulesVersion)
    return `gameplay data for ${encounterId} changed without a rulesVersion bump. If the change is intended, bump rulesVersion and update rules-fingerprint.json:\n${entry}`;
  return `${encounterId} rulesVersion bumped; update rules-fingerprint.json:\n${entry}`;
}

const encounterIds = Object.keys(encounterData.encounters);

describe("rules fingerprint", () => {
  test.each(encounterIds)("%s matches its recorded fingerprint", (encounterId) => {
    const problem = fingerprintProblem(SHIPPED, encounterId, stored);
    expect(problem, problem ?? "").toBeNull();
  });

  test("the fingerprint file names exactly the shipped encounters", () => {
    expect(Object.keys(stored).sort()).toEqual([...encounterIds].sort());
  });

  describe("the detection itself", () => {
    const encounterId = "killer-bee-queen";
    const clone = (): { -readonly [K in keyof GameplayData]: GameplayData[K] } =>
      structuredClone(SHIPPED) as never;

    test("a gameplay number changed without a version bump fails with the first message", () => {
      const scratch = clone();
      (scratch.projectiles.projectiles as Record<string, { damageHp: number }>)[
        valuesOfKey(scratch.enemies["killer-bee-queen"], "projectile")[0]
      ].damageHp += 1;
      expect(fingerprintProblem(scratch, encounterId, stored)).toMatch(
        /gameplay data for killer-bee-queen changed without a rulesVersion bump/,
      );
    });

    test("a bump without a refreshed hash fails with the second message", () => {
      const scratch = clone();
      (scratch.encounter.encounters as Record<string, { rulesVersion: string }>)[encounterId].rulesVersion += "-next";
      expect(fingerprintProblem(scratch, encounterId, stored)).toMatch(
        /killer-bee-queen rulesVersion bumped; update rules-fingerprint.json/,
      );
    });

    test("an appearance-only change leaves the fingerprint current", () => {
      const scratch = clone();
      const id = valuesOfKey(scratch.enemies["killer-bee-queen"], "projectile")[0];
      const entry = (scratch.projectiles.projectiles as unknown as Record<string, Record<string, unknown>>)[id];
      entry.appearance = "other-sprite";
      entry.source = "reworded";
      expect(fingerprintProblem(scratch, encounterId, stored)).toBeNull();
    });
  });
});
