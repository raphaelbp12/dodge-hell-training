import { afterEach, describe, expect, test, vi } from "vitest";
import appearancesData from "../data/projectile-appearances.json";
import arenaData from "../data/arena.json";
import encounterData from "../data/encounter.json";
import nestRedData from "../data/enemies/killer-bee-nest-red.json";
import queenData from "../data/enemies/killer-bee-queen.json";
import projectilesData from "../data/projectiles.json";
import shapesData from "../data/shapes.json";
import {
  AUTHORED_APPEARANCES,
  AUTHORED_ENCOUNTER_DATA,
  AUTHORED_PROJECTILES,
  loadOutline,
  validateAppearances,
  validateArchetypes,
  validateArenaMap,
  validateEncounterData,
  validateProjectiles,
} from "./data";

/**
 * Plan V22 A11: every shipped data file is claimed by exactly one validator and
 * passes it, and every cross-file reference fails loading when it dangles.
 */

const DATA_FILES = import.meta.glob("../data/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const STEP_SECONDS = AUTHORED_ENCOUNTER_DATA.simulation.fixedStepSeconds;
const APPEARANCE_IDS = new Set(Object.keys(AUTHORED_APPEARANCES.appearances));
const PROJECTILE_IDS = new Set(Object.keys(AUTHORED_PROJECTILES));
const MAX_MINIONS = AUTHORED_ENCOUNTER_DATA.maxConcurrentMinions;

const ENEMY_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(DATA_FILES)
    .map(([path, value]) => [/\/enemies\/([a-z0-9-]+)\.json$/.exec(path)?.[1], value] as const)
    .filter((entry): entry is readonly [string, unknown] => entry[0] !== undefined),
);

type Claim = Readonly<{
  pattern: RegExp;
  validate: (value: unknown, path: string) => unknown;
}>;

/** Each pattern names the validator that consumes the files it matches. */
const CLAIMS: readonly Claim[] = [
  { pattern: /^\.\.\/data\/arena\.json$/, validate: (value) => validateArenaMap(value) },
  { pattern: /^\.\.\/data\/encounter\.json$/, validate: (value) => validateEncounterData(value) },
  {
    pattern: /^\.\.\/data\/projectiles\.json$/,
    validate: (value) => validateProjectiles(value, STEP_SECONDS, APPEARANCE_IDS),
  },
  {
    pattern: /^\.\.\/data\/projectile-appearances\.json$/,
    validate: (value) => validateAppearances(value),
  },
  {
    // shapes.json is validated at module load by an unexported function; the
    // public contract is that every named outline loads.
    pattern: /^\.\.\/data\/shapes\.json$/,
    validate: (value) => {
      for (const name of Object.keys((value as { shapes: object }).shapes))
        loadOutline(name);
    },
  },
  {
    pattern: /^\.\.\/data\/enemies\/([a-z0-9-]+)\.json$/,
    // Spawned archetypes resolve against the whole set, so every monster is
    // validated together and this file must appear in the result.
    validate: (_value, path) => {
      const id = /\/([a-z0-9-]+)\.json$/.exec(path)?.[1] ?? "";
      const loaded = validateArchetypes({ archetypes: ENEMY_FILES }, PROJECTILE_IDS, MAX_MINIONS);
      if (!(id in loaded)) throw new RangeError(`${id} was not loaded`);
    },
  },
];

describe("every data file is claimed and valid", () => {
  const paths = Object.keys(DATA_FILES);

  test("the glob found the shipped files", () => {
    expect(paths.length).toBeGreaterThanOrEqual(CLAIMS.length);
  });

  test.each(paths)("%s matches exactly one claim and passes its validator", (path) => {
    const claims = CLAIMS.filter((claim) => claim.pattern.test(path));
    expect(claims).toHaveLength(1);
    expect(() => claims[0].validate(DATA_FILES[path], path)).not.toThrow();
  });

  test("every claim matches at least one file", () => {
    for (const claim of CLAIMS)
      expect(paths.some((path) => claim.pattern.test(path))).toBe(true);
  });
});

/** A deep copy with the first value stored under `key` replaced. */
function withFirstKeyReplaced<T>(document: T, key: string, replacement: unknown): T {
  const copy = structuredClone(document);
  let replaced = false;
  const walk = (node: unknown): void => {
    if (replaced || typeof node !== "object" || node === null) return;
    const entries = node as Record<string, unknown>;
    if (key in entries) {
      entries[key] = replacement;
      replaced = true;
      return;
    }
    for (const child of Object.values(entries)) walk(child);
  };
  walk(copy);
  if (!replaced) throw new Error(`Fixture has no "${key}" to break`);
  return copy;
}

const DANGLING_ID = "does-not-exist";

type Fixture = Readonly<{
  name: string;
  file: string;
  /** The broken copy of the file, which is substituted for the shipped one. */
  broken: () => unknown;
  /** The rejection must name this path or field. */
  message: RegExp;
}>;

const FIXTURES: readonly Fixture[] = [
  {
    name: "an attack's projectile id",
    file: "../data/enemies/killer-bee-queen.json",
    broken: () => withFirstKeyReplaced(queenData, "projectile", DANGLING_ID),
    message: /projectile/,
  },
  {
    name: "a projectile's appearance id",
    file: "../data/projectiles.json",
    broken: () => withFirstKeyReplaced(projectilesData, "appearance", DANGLING_ID),
    message: /appearance/,
  },
  {
    name: "a spawned archetype id",
    file: "../data/enemies/killer-bee-nest-red.json",
    broken: () => withFirstKeyReplaced(nestRedData, "archetype", DANGLING_ID),
    message: /archetype/,
  },
  {
    name: "an encounter's arenaId",
    file: "../data/encounter.json",
    broken: () => withFirstKeyReplaced(encounterData, "arenaId", DANGLING_ID),
    message: /arena/i,
  },
  {
    name: "a body's shape id",
    file: "../data/shapes.json",
    broken: () => {
      const copy = structuredClone(shapesData) as { shapes: Record<string, unknown> };
      delete copy.shapes["beveled-octagon"];
      return copy;
    },
    message: /beveled-octagon|shape/,
  },
];

describe("a dangling cross-file reference fails loading", () => {
  afterEach(() => {
    vi.doUnmock("../data/enemies/killer-bee-queen.json");
    vi.doUnmock("../data/projectiles.json");
    vi.doUnmock("../data/enemies/killer-bee-nest-red.json");
    vi.doUnmock("../data/encounter.json");
    vi.doUnmock("../data/shapes.json");
    vi.resetModules();
  });

  test.each(FIXTURES)("$name", async ({ file, broken, message }) => {
    vi.resetModules();
    vi.doMock(file, () => ({ default: broken() }));
    await expect(import("./encounter")).rejects.toThrow(message);
  });

  test("the unbroken fixtures load, so a rejection is caused by the broken reference", async () => {
    vi.resetModules();
    await expect(import("./encounter")).resolves.toBeDefined();
  });

  test("the claimed JSON imports are the shipped files", () => {
    expect(DATA_FILES["../data/arena.json"]).toBe(arenaData);
    expect(DATA_FILES["../data/projectile-appearances.json"]).toBe(appearancesData);
  });
});
