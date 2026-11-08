import { describe, expect, test } from "vitest";
import { DEFAULT_DEBUG_SETTINGS } from "../game/config/debug";
import { AUTHORED_MONSTER_FILES, type AuthoredAttack } from "../game/config/data";
import {
  archetypeOf,
  attackSpecFromAuthored,
  encounterConfigOf,
  type EncounterConfig,
} from "../game/config/encounter";
import {
  advanceSimulation,
  createSimulation,
  setDebugSettings,
} from "../game/simulation/simulation";
import { resolveBearings } from "../game/simulation/patterns";
import {
  blockWindows,
  draftPreviewAt,
  draftVolleysLiveAt,
  NO_TAG_INDEX,
  type BlockWindow,
} from "./draftPreview";
import {
  blocksOfMonster,
  loadMonsterDraft,
  setAnchor,
  type DraftBlock,
} from "./monsterDraft";

const queen = encounterConfigOf("killer-bee-queen");
const IDLE = { north: false, south: false, east: false, west: false };

const block = (id: string, telegraph: number, duration: number | null): DraftBlock => ({
  id,
  phaseId: id,
  subPhaseId: null,
  label: id,
  telegraphSeconds: telegraph,
  durationSeconds: duration,
});

describe("blockWindows", () => {
  test("epoch adds the telegraph and unanchored blocks have no window", () => {
    const [window, ...rest] = blockWindows([block("a", 2, null), block("b", 1, null)], { a: 10 }, 100);
    expect(window).toMatchObject({ blockId: "a", anchorSeconds: 10, epochSeconds: 12, endSeconds: 100 });
    expect(rest).toEqual([]);
  });

  test("a timed block stops at its duration, or earlier at a nearer next anchor", () => {
    const blocks = [block("a", 0, 29), block("b", 0, null)];
    expect(blockWindows(blocks, { a: 5 }, 100)[0].endSeconds).toBe(34);
    const both = blockWindows(blocks, { a: 5, b: 20 }, 100);
    expect(both.find((w) => w.blockId === "a")!.endSeconds).toBe(20);
    expect(both.find((w) => w.blockId === "b")!.endSeconds).toBe(100);
  });

  test("an untimed block stops at the next anchor", () => {
    const blocks = [block("a", 0, null), block("b", 0, null)];
    expect(blockWindows(blocks, { a: 5, b: 9 }, 100)[0].endSeconds).toBe(9);
  });

  test("a same-time pair resolves in authored order, the later one winning", () => {
    const blocks = [block("a", 0, null), block("b", 0, null)];
    const [first, second] = blockWindows(blocks, { a: 5, b: 5 }, 100);
    expect(first.blockId).toBe("a");
    expect(first.endSeconds).toBe(5);
    expect(second.endSeconds).toBe(100);
  });
});

describe("draftVolleysLiveAt", () => {
  const window: BlockWindow = { blockId: "a", anchorSeconds: 0, epochSeconds: 2, endSeconds: 20 };
  const cadence = {
    shotsPerBurst: 3,
    shotIntervalSeconds: 0.5,
    cooldownAfterLastShotSeconds: 2,
    initialDelaySeconds: 1,
  };

  test("uses interval and cooldown as the formula states", () => {
    const times = draftVolleysLiveAt(cadence, window, 9, 100).map((v) => v.timeSeconds);
    // base 3, period 3: bursts at 3, 6, 9 with shots 0.5 apart.
    expect(times).toEqual([3, 3.5, 4, 6, 6.5, 7, 9]);
    const last = draftVolleysLiveAt(cadence, window, 6.5, 100).at(-1)!;
    expect(last).toMatchObject({ burstIndex: 1, volleyIndex: 1 });
  });

  test("a volley at exactly the end does not fire, and one fired before it stays in flight", () => {
    const w = { ...window, endSeconds: 6 };
    expect(draftVolleysLiveAt(cadence, w, 6, 100).map((v) => v.timeSeconds)).toEqual([3, 3.5, 4]);
    expect(draftVolleysLiveAt(cadence, w, 8, 100).map((v) => v.timeSeconds)).toEqual([3, 3.5, 4]);
    expect(draftVolleysLiveAt(cadence, w, 8, 4.2).map((v) => v.timeSeconds)).toEqual([4]);
  });

  test("a late time returns a bounded set", () => {
    const late = draftVolleysLiveAt(cadence, { ...window, endSeconds: 1e9 }, 1e6, 5);
    expect(late.length).toBeLessThanOrEqual(6);
    expect(late.length).toBeGreaterThan(0);
  });
});

/** The primary monster with one phase holding only `authored`, no spawns. */
function oneAttackConfig(authored: AuthoredAttack): EncounterConfig {
  const primary = archetypeOf(queen, queen.primaryArchetypeId);
  const base = primary.phases[2];
  return {
    ...queen,
    archetypes: {
      ...queen.archetypes,
      [primary.id]: {
        ...primary,
        phases: [
          {
            ...base,
            enterAtHpFraction: 1,
            exitAfterSeconds: null,
            subPhases: null,
            spawns: null,
            progression: null,
            attacks: [attackSpecFromAuthored(authored)],
          },
        ],
      },
    },
  };
}

function simulatedVolleyTimes(config: EncounterConfig, seconds: number): number[] {
  const state = createSimulation(config, 1);
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  const step = config.simulation.fixedStepSeconds;
  const times: number[] = [];
  let seen = state.nextShardId;
  while (state.elapsedSeconds < seconds) {
    advanceSimulation(state, step, IDLE);
    if (state.nextShardId !== seen) times.push(state.elapsedSeconds);
    seen = state.nextShardId;
  }
  return times;
}

describe("draftVolleysLiveAt against the simulation", () => {
  const attack = (cadence: AuthoredAttack["cadence"]): AuthoredAttack => ({
    id: "probe",
    projectile: "red-stinger-v2" in queen.projectiles ? "red-stinger-v2" : Object.keys(queen.projectiles)[0],
    tuningSource: "video-observation",
    pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "fixed", fixedBearingDegrees: 0, emitterRadiusTiles: 0 },
    cadence,
  });

  for (const [name, cadence] of [
    ["a single shot", { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 0.7, initialDelaySeconds: 0.42 }],
    ["a multi-shot burst", { shotsPerBurst: 3, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1.4, initialDelaySeconds: 0.42 }],
  ] as const) {
    test(`matches the real clock for ${name}`, () => {
      const config = oneAttackConfig(attack(cadence));
      const step = config.simulation.fixedStepSeconds;
      const real = simulatedVolleyTimes(config, 12);
      const window = { blockId: "x", anchorSeconds: 0, epochSeconds: config.archetypes[config.primaryArchetypeId].phases[0].telegraphSeconds, endSeconds: 12 };
      const predicted = draftVolleysLiveAt(cadence, window, 12, 1e9).map((v) => v.timeSeconds);
      expect(real.length).toBeGreaterThan(3);
      expect(predicted.length).toBe(real.length);
      predicted.forEach((time, index) => expect(Math.abs(real[index] - time)).toBeLessThanOrEqual(step * 1.5));
    });
  }
});

describe("draftPreviewAt", () => {
  const raw = AUTHORED_MONSTER_FILES["killer-bee-queen"];
  const blocks = blocksOfMonster(archetypeOf(queen, "killer-bee-queen"));
  const loaded = loadMonsterDraft(raw, null).draft;
  const player = { x: 0, y: 0 };
  const frameAt = (draft: typeof loaded, time: number) =>
    draftPreviewAt({ draft, blocks, config: queen, timeSeconds: time, videoEndSeconds: 200, playerTiles: player, headingRadians: 0 });

  test("an unanchored draft draws nothing", () => {
    const { frame } = frameAt(loaded, 30);
    expect(frame.projectiles).toHaveLength(0);
    expect(frame.detonations).toHaveLength(0);
    expect(frame.unmatchedTagCount).toBe(0);
  });

  test("an anchored block draws shots tagged with no tag", () => {
    const draft = setAnchor(loaded, "phase-3-pond-barrage", 0);
    const { frame } = frameAt(draft, 4);
    expect(frame.projectiles.length).toBeGreaterThan(0);
    expect(frame.projectiles.every((p) => p.tagIndex === NO_TAG_INDEX)).toBe(true);
  });

  test("shots outlive their block's end", () => {
    const draft = setAnchor(setAnchor(loaded, "phase-3-pond-barrage", 0), "phase-4-glaive-circle", 4);
    const before = frameAt(draft, 3.9).frame.projectiles.length;
    expect(before).toBeGreaterThan(0);
    const after = frameAt({ ...draft, anchors: { "phase-3-pond-barrage": 0, "phase-4-glaive-circle": 1000 } }, 4.1);
    expect(after.frame.projectiles.length).toBeGreaterThan(0);
  });

  test("per-burst advance changes the bearings between bursts as in resolveBearings", () => {
    const authored = {
      id: "adv",
      projectile: Object.keys(queen.projectiles).find((id) => queen.projectiles[id].appearance && queen.projectiles[id].type === "bullet")!,
      tuningSource: "video-observation",
      pattern: { kind: "ring", arms: 1, emitterRadiusTiles: 0, initialPhaseDegrees: 0, clockwiseDegreesPerSecond: 0, perBurstAdvanceDegrees: 30 },
      cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1, initialDelaySeconds: 0 },
    } as AuthoredAttack;
    const draft = {
      anchors: { only: 0 },
      phases: [{ phaseId: "only", attacks: [authored], subPhases: [] }],
    };
    const only = [block("only", 0, null)];
    const at = (time: number) =>
      draftPreviewAt({ draft, blocks: only, config: queen, timeSeconds: time, videoEndSeconds: 50, playerTiles: player, headingRadians: 0 }).frame.projectiles;
    const spec = attackSpecFromAuthored(authored);
    const bearing = (burst: number) =>
      resolveBearings(spec.pattern, { enemyPositionTiles: { x: 0, y: 0 }, playerPositionTiles: player, enemyHeadingRadians: 0, ringPhaseRadians: 0, volleyIndexInBurst: 0, burstsFired: burst, secondsSinceEpoch: 0 })[0].bearingRadians;
    expect(bearing(1)).not.toBeCloseTo(bearing(0));
    const first = at(0.2)[0];
    const second = at(1.2).find((p) => Math.abs(p.orientationRadians - bearing(1)) < 1e-9);
    expect(first.orientationRadians).toBeCloseTo(bearing(0));
    expect(second).toBeDefined();
  });

  test("a targeted bomb lands at the player point", () => {
    const bomb = Object.keys(queen.projectiles).find((id) => queen.projectiles[id].type === "bomb" && queen.projectiles[id].appearance)!;
    const authored = {
      id: "bomb",
      projectile: bomb,
      tuningSource: "video-observation",
      target: "player",
      pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
      cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 30, initialDelaySeconds: 0 },
    } as AuthoredAttack;
    const draft = { anchors: { only: 0 }, phases: [{ phaseId: "only", attacks: [authored], subPhases: [] }] };
    const spec = queen.projectiles[bomb];
    const travel = spec.type === "bomb" ? spec.travelSeconds : 0;
    const frame = draftPreviewAt({ draft, blocks: [block("only", 0, null)], config: queen, timeSeconds: travel + 0.01, videoEndSeconds: 50, playerTiles: { x: 3, y: 2 }, headingRadians: 0 }).frame;
    expect(frame.detonations[0].positionTiles).toEqual({ x: 3, y: 2 });
  });

  test("an attack with no sprite is reported and draws nothing", () => {
    const worm = encounterConfigOf("crystal-worm");
    const noSprite = Object.keys(worm.projectiles).find((id) => !worm.projectiles[id].appearance);
    expect(noSprite).toBeDefined();
    const authored = {
      id: "blank",
      projectile: noSprite,
      tuningSource: "video-observation",
      pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
      cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1, initialDelaySeconds: 0 },
    } as AuthoredAttack;
    const draft = { anchors: { only: 0 }, phases: [{ phaseId: "only", attacks: [authored], subPhases: [] }] };
    const result = draftPreviewAt({ draft, blocks: [block("only", 0, null)], config: worm, timeSeconds: 2, videoEndSeconds: 50, playerTiles: player, headingRadians: 0 });
    expect(result.undrawnAttackIds).toEqual(["blank"]);
    expect(result.frame.projectiles).toHaveLength(0);
  });
});

describe("draftPreviewAt against the simulation", () => {
  test("projectile count matches a real run of one block at sampled times", () => {
    const projectile = Object.keys(queen.projectiles).find(
      (id) => queen.projectiles[id].type === "bullet" && queen.projectiles[id].appearance,
    )!;
    const authored = {
      id: "probe",
      projectile,
      tuningSource: "video-observation",
      pattern: { kind: "ring", arms: 3, emitterRadiusTiles: 0.2, initialPhaseDegrees: 10, clockwiseDegreesPerSecond: 20 },
      cadence: { shotsPerBurst: 2, shotIntervalSeconds: 0.2, cooldownAfterLastShotSeconds: 0.9, initialDelaySeconds: 0.3 },
    } as AuthoredAttack;
    const config = oneAttackConfig(authored);
    const phase = config.archetypes[config.primaryArchetypeId].phases[0];
    const draft = { anchors: { only: 0 }, phases: [{ phaseId: "only", attacks: [authored], subPhases: [] }] };
    const only = [{ id: "only", phaseId: "only", subPhaseId: null, label: "only", telegraphSeconds: phase.telegraphSeconds, durationSeconds: null }];
    const state = createSimulation(config, 1);
    setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
    const step = config.simulation.fixedStepSeconds;
    const samples = [3, 5, 8, 11];
    for (const sample of samples) {
      while (state.elapsedSeconds < sample - step / 2) advanceSimulation(state, step, IDLE);
      const preview = draftPreviewAt({ draft, blocks: only, config, timeSeconds: state.elapsedSeconds, videoEndSeconds: 1e6, playerTiles: { x: 0, y: 0 }, headingRadians: 0 });
      expect(Math.abs(preview.frame.projectiles.length - state.shards.length)).toBeLessThanOrEqual(3);
    }
  });
});
