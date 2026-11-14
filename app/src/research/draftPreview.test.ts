import { describe, expect, test } from "vitest";
import { DEFAULT_DEBUG_SETTINGS } from "../game/config/debug";
import { AUTHORED_MONSTER_FILES, type AuthoredAttack } from "../game/config/data";
import {
  archetypeOf,
  attackSpecFromAuthored,
  ENCOUNTER_CONFIGS,
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
  draftVolleysLiveAt,
  fittedPreviewAt,
  observedPreviewAt,
  windowsFromBoundaries,
  type BlockWindow,
} from "./draftPreview";
import { segmentsOfMonster, segmentWindows, type SegmentWindow, type StudyV5 } from "./study";
import { emptyStudy } from "./studyMigrate";

const queen = encounterConfigOf("killer-bee-queen");
const IDLE = { north: false, south: false, east: false, west: false };

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

/** A study holding one track of `authored` in segment "only", fitted in one window from 0 s. */
function fittedOne(
  authored: AuthoredAttack,
  config: EncounterConfig,
  input: Readonly<{ telegraphSeconds?: number; endSeconds?: number; timeSeconds: number; playerTiles?: { x: number; y: number } }>,
) {
  const study: StudyV5 = {
    schemaVersion: 5,
    encounterId: "e",
    archetypeId: "m",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 1e6 },
    boundaries: [],
    statusSpans: [],
    tracks: [{ id: authored.id, location: { phaseId: "only", subPhaseId: null }, attack: authored, cadenceSource: "authored", marks: [] }],
    scratch: [],
    acceptedSegmentValues: {},
  };
  const windows: SegmentWindow[] = [
    { segmentId: "only", startSeconds: 0, epochSeconds: input.telegraphSeconds ?? 0, endSeconds: input.endSeconds ?? 1e6 },
  ];
  return fittedPreviewAt({
    study,
    segments: [],
    windows,
    config,
    timeSeconds: input.timeSeconds,
    playerTiles: input.playerTiles ?? { x: 0, y: 0 },
    headingRadians: 0,
  });
}

describe("fittedPreviewAt on one track", () => {
  const player = { x: 0, y: 0 };
  const single = (cooldown: number): AuthoredAttack =>
    ({
      id: "one",
      projectile: Object.keys(queen.projectiles).find((id) => queen.projectiles[id].appearance && queen.projectiles[id].type === "bullet")!,
      tuningSource: "video-observation",
      pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
      cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: cooldown, initialDelaySeconds: 0 },
    }) as AuthoredAttack;

  test("shots outlive their window's end, and none fire after it", () => {
    expect(fittedOne(single(0.5), queen, { endSeconds: 4, timeSeconds: 3.9 }).frame.projectiles.length).toBeGreaterThan(0);
    expect(fittedOne(single(0.5), queen, { endSeconds: 4, timeSeconds: 4.1 }).frame.projectiles.length).toBeGreaterThan(0);
    expect(fittedOne(single(0.5), queen, { endSeconds: 4, timeSeconds: 60 }).frame.projectiles).toHaveLength(0);
  });

  test("per-burst advance changes the bearings between bursts as in resolveBearings", () => {
    const authored = {
      id: "adv",
      projectile: Object.keys(queen.projectiles).find((id) => queen.projectiles[id].appearance && queen.projectiles[id].type === "bullet")!,
      tuningSource: "video-observation",
      pattern: { kind: "ring", arms: 1, emitterRadiusTiles: 0, initialPhaseDegrees: 0, clockwiseDegreesPerSecond: 0, perBurstAdvanceDegrees: 30 },
      cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1, initialDelaySeconds: 0 },
    } as AuthoredAttack;
    const at = (time: number) => fittedOne(authored, queen, { endSeconds: 50, timeSeconds: time }).frame.projectiles;
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
    const spec = queen.projectiles[bomb];
    const travel = spec.type === "bomb" ? spec.travelSeconds : 0;
    const { frame } = fittedOne(authored, queen, { endSeconds: 50, timeSeconds: travel + 0.01, playerTiles: { x: 3, y: 2 } });
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
    const result = fittedOne(authored, worm, { endSeconds: 50, timeSeconds: 2 });
    expect(result.undrawnAttackIds).toEqual(["blank"]);
    expect(result.frame.projectiles).toHaveLength(0);
  });
});

describe("fittedPreviewAt against the simulation", () => {
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
    const state = createSimulation(config, 1);
    setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
    const step = config.simulation.fixedStepSeconds;
    const samples = [3, 5, 8, 11];
    for (const sample of samples) {
      while (state.elapsedSeconds < sample - step / 2) advanceSimulation(state, step, IDLE);
      const preview = fittedOne(authored, config, { telegraphSeconds: phase.telegraphSeconds, timeSeconds: state.elapsedSeconds });
      expect(Math.abs(preview.frame.projectiles.length - state.shards.length)).toBeLessThanOrEqual(3);
    }
  });
});

describe("the timeline preview (plan V20 step 86.4)", () => {
  const segments = segmentsOfMonster(archetypeOf(queen, "killer-bee-queen"));
  const base = emptyStudy({
    encounterId: "killer-bee-queen",
    archetypeId: "killer-bee-queen",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 200 },
    recordedAt: "2026-11-13T00:00:00.000Z",
    rawFile: AUTHORED_MONSTER_FILES["killer-bee-queen"],
  });
  const index = base.tracks.findIndex((track) => {
    const projectile = queen.projectiles[track.attack.projectile];
    return projectile?.appearance !== undefined && projectile.type === "bullet";
  });
  const chosen = base.tracks[index];
  const segmentId = chosen.location.subPhaseId === null
    ? chosen.location.phaseId
    : `${chosen.location.phaseId}/${chosen.location.subPhaseId}`;
  const study: StudyV5 = {
    ...base,
    boundaries: [{ timeSeconds: 0, segmentId }],
    tracks: base.tracks.map((track, at) =>
      at === index ? { ...track, marks: [{ timeSeconds: 1, kind: "volley" }] } : track,
    ),
  };
  const windows = segmentWindows(study.boundaries, segments, 200);
  const input = (timeSeconds: number) => ({
    study,
    segments,
    windows,
    config: queen,
    timeSeconds,
    playerTiles: { x: 0, y: 0 },
    headingRadians: 0,
  });

  test("windowsFromBoundaries maps a window one-to-one", () => {
    const window: SegmentWindow = { segmentId: "a", startSeconds: 2, epochSeconds: 3, endSeconds: 9 };
    expect(windowsFromBoundaries([window])).toEqual([
      { blockId: "a", anchorSeconds: 2, epochSeconds: 3, endSeconds: 9 },
    ]);
  });

  test("observedPreviewAt draws a mark's volley from its own age only", () => {
    expect(observedPreviewAt(input(0.99)).frame.projectiles).toHaveLength(0);
    const after = observedPreviewAt(input(1.1)).frame.projectiles;
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((projectile) => projectile.tagIndex === index)).toBe(true);
    expect(after.some((projectile) => projectile.ghost)).toBe(false);
  });

  test("fittedPreviewAt marks every entry as a ghost", () => {
    const { frame } = fittedPreviewAt(input(30));
    expect(frame.projectiles.length).toBeGreaterThan(0);
    expect(frame.projectiles.every((projectile) => projectile.ghost === true)).toBe(true);
    expect(frame.detonations.every((detonation) => detonation.ghost === true)).toBe(true);
  });
});

describe("a bomb track's flight-time override (plan V20 step 87.1)", () => {
  const found = Object.entries(ENCOUNTER_CONFIGS).flatMap(([encounterId, config]) =>
    Object.keys(config.archetypes)
      .filter((archetypeId) => AUTHORED_MONSTER_FILES[archetypeId] !== undefined)
      .map((archetypeId) => ({ encounterId, archetypeId, config })),
  ).flatMap(({ encounterId, archetypeId, config }) => {
    const base = emptyStudy({
      encounterId,
      archetypeId,
      provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 200 },
      recordedAt: "2026-11-13T00:00:00.000Z",
      rawFile: AUTHORED_MONSTER_FILES[archetypeId],
    });
    const index = base.tracks.findIndex((track) => {
      const projectile = config.projectiles[track.attack.projectile];
      return projectile?.type === "bomb" && projectile.appearance?.bomb !== undefined;
    });
    return index < 0 ? [] : [{ base, index, config, archetypeId }];
  })[0];

  test("observedPreviewAt detonates at the override's travel time", () => {
    expect(found).toBeDefined();
    const { base, index, config, archetypeId } = found!;
    const segments = segmentsOfMonster(archetypeOf(config, archetypeId));
    const chosen = base.tracks[index];
    const projectile = config.projectiles[chosen.attack.projectile]!;
    const travelSeconds = projectile.type === "bomb" ? projectile.travelSeconds : 0;
    const override = travelSeconds + 0.5;
    const studyOf = (projectileOverride?: { travelSeconds: number }): StudyV5 => ({
      ...base,
      boundaries: [{ timeSeconds: 0, segmentId: segments[0].id }],
      tracks: base.tracks.map((track, at) =>
        at === index
          ? {
              ...track,
              location: segments[0].ref,
              marks: [{ timeSeconds: 1, kind: "volley" }],
              ...(projectileOverride ? { projectileOverride } : {}),
            }
          : track,
      ),
    });
    const at = (study: StudyV5, timeSeconds: number) =>
      observedPreviewAt({
        study,
        segments,
        windows: segmentWindows(study.boundaries, segments, 200),
        config,
        timeSeconds,
        playerTiles: { x: 0, y: 0 },
        headingRadians: 0,
      }).frame.detonations.filter((detonation) => detonation.tagIndex === index);
    const probe = 1 + travelSeconds + 0.01;
    expect(at(studyOf(), probe).length).toBeGreaterThan(0);
    expect(at(studyOf({ travelSeconds: override }), probe)).toHaveLength(0);
    expect(at(studyOf({ travelSeconds: override }), 1 + override + 0.01).length).toBeGreaterThan(0);
  });
});
