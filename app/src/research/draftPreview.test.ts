import { describe, expect, test } from "vitest";
import { DEFAULT_DEBUG_SETTINGS } from "../game/config/debug";
import type { CadencedAuthoredAttack } from "../game/config/data";
import {
  archetypeOf,
  attackSpecFromAuthored,
  encounterConfigOf,
  type AttackMarks,
  type EncounterConfig,
} from "../game/config/encounter";
import { advanceSimulation, createSimulation, setDebugSettings } from "../game/simulation/simulation";
import { previewAt, previewVolleysOf } from "./draftPreview";
import type { AttackTrack, Mark, SegmentWindow, StudyV6 } from "./study";
import { trackMarksOf } from "./trackMarks";

const queen = encounterConfigOf("killer-bee-queen");
const IDLE = { north: false, south: false, east: false, west: false };
const bullet = Object.keys(queen.projectiles).find(
  (id) => queen.projectiles[id].appearance && queen.projectiles[id].type === "bullet",
)!;

const attack: CadencedAuthoredAttack = {
  id: "probe",
  projectile: bullet,
  tuningSource: "video-observation",
  pattern: { kind: "spread", shots: 1, arcDegrees: 0, aim: "fixed", fixedBearingDegrees: 0, emitterRadiusTiles: 0 },
  // Plan V23 Q15: kept, and ignored because the track has marks.
  cadence: { shotsPerBurst: 1, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 0.5, initialDelaySeconds: 0 },
};
const volleys = (...times: number[]): Mark[] => times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));
const track = (overrides: Partial<AttackTrack> = {}): AttackTrack => ({
  id: "probe",
  location: { phaseId: "only", subPhaseId: null },
  attack,
  marks: [],
  ...overrides,
});
const window = (startSeconds: number, endSeconds: number, telegraphSeconds = 1): SegmentWindow => ({
  segmentId: "only",
  startSeconds,
  epochSeconds: startSeconds + telegraphSeconds,
  endSeconds,
});
const timesOf = (entries: ReturnType<typeof previewVolleysOf>) =>
  entries.map((entry) => Math.round(entry.volley.timeSeconds * 1000) / 1000);

describe("previewVolleysOf (plan V23 step 99.1)", () => {
  const windows = [window(10, 20), window(30, 40)];

  test("a marked track draws its marks in its first window and the same offsets in a later window (Q04)", () => {
    const marked = track({ marks: volleys(12, 12.5, 15, 35.2) });
    expect(timesOf(previewVolleysOf(marked, windows, 39, 100))).toEqual([12, 12.5, 15, 32, 32.5, 35]);
  });

  test("a mark during the telegraph is drawn (Q03)", () => {
    const marked = track({ marks: volleys(10.5) });
    expect(timesOf(previewVolleysOf(marked, windows, 10.6, 100))).toEqual([10.5]);
  });

  test("a periodic track repeats until its stop, and a started cycle finishes (Q06, Q07)", () => {
    const periodic = track({ marks: volleys(11, 11.5), periodSeconds: 3, endSeconds: 17.5 });
    // Cycles start at 11, 14 and 17; the one at 20 is after the stop at 17.5.
    expect(timesOf(previewVolleysOf(periodic, [window(10, 25)], 25, 100))).toEqual([11, 11.5, 14, 14.5, 17, 17.5]);
  });

  test("volleys stop at the window's end and leave the drawing after their lifetime", () => {
    const periodic = track({ marks: volleys(11), periodSeconds: 3 });
    expect(timesOf(previewVolleysOf(periodic, [window(10, 18)], 30, 100))).toEqual([11, 14, 17]);
    expect(timesOf(previewVolleysOf(periodic, [window(10, 18)], 17.5, 1))).toEqual([17]);
  });

  test("a burst's volleys carry the burst and shot indices the game uses", () => {
    const marked = track({ marks: volleys(11, 11.1, 11.2, 13, 13.1, 13.2) });
    expect(
      previewVolleysOf(marked, [window(10, 20)], 20, 100).map(({ volley }) => [volley.burstIndex, volley.volleyIndex]),
    ).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
  });

  test("a track with no volley mark in its first window draws nothing, even with later marks (Q16)", () => {
    expect(previewVolleysOf(track({ marks: volleys(35) }), windows, 39, 100)).toEqual([]);
    expect(previewVolleysOf(track(), windows, 39, 100)).toEqual([]);
  });
});

function studyOf(tracks: readonly AttackTrack[]): StudyV6 {
  return {
    schemaVersion: 6,
    encounterId: "e",
    archetypeId: "m",
    recordedAt: "2026-11-13T00:00:00.000Z",
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    boundaries: [],
    statusSpans: [],
    tracks,
    scratch: [],
  };
}

describe("previewAt", () => {
  const frameAt = (tracks: readonly AttackTrack[], timeSeconds: number) =>
    previewAt({
      study: studyOf(tracks),
      windows: [window(10, 20)],
      config: queen,
      timeSeconds,
      playerTiles: { x: 0, y: 0 },
      headingRadians: 0,
    });

  test("draws a marked volley once it fires, tagged with its track's index", () => {
    const tracks = [track({ id: "dropped" }), track({ marks: volleys(12) })];
    expect(frameAt(tracks, 11.9).frame.projectiles).toHaveLength(0);
    const after = frameAt(tracks, 12.1).frame.projectiles;
    expect(after).toHaveLength(1);
    expect(after[0].tagIndex).toBe(1);
  });

  test("a track whose projectile has no sprite is reported, not drawn", () => {
    const unseen = Object.keys(queen.projectiles).find((id) => !queen.projectiles[id].appearance);
    if (!unseen) return;
    const frame = frameAt([track({ attack: { ...attack, projectile: unseen }, marks: volleys(12) })], 12.1);
    expect(frame.undrawnAttackIds).toEqual(["probe"]);
  });
});

/** The primary monster with one phase holding only `marks` as an attack, no spawns. */
function oneMarkedAttackConfig(marks: AttackMarks): EncounterConfig {
  const primary = archetypeOf(queen, queen.primaryArchetypeId);
  const { cadence: _cadence, ...rest } = attack;
  return {
    ...queen,
    archetypes: {
      ...queen.archetypes,
      [primary.id]: {
        ...primary,
        phases: [
          {
            ...primary.phases[2],
            enterAtHpFraction: 1,
            exitAfterSeconds: null,
            subPhases: null,
            spawns: null,
            progression: null,
            attacks: [attackSpecFromAuthored({ ...rest, marks })],
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
    for (let shard = seen; shard < state.nextShardId; shard++) times.push(state.elapsedSeconds);
    seen = state.nextShardId;
  }
  return times;
}

describe("the preview and the game fire the same volleys (Q01)", () => {
  for (const [name, marks, periodSeconds] of [
    ["once-only marks", volleys(0.4, 0.5, 0.6, 2, 2, 3.3), undefined],
    ["a periodic cycle", volleys(0.4, 0.9), 1.7],
  ] as const) {
    test(name, () => {
      const marked = track({ marks, ...(periodSeconds === undefined ? {} : { periodSeconds }) });
      const windows = [window(0, 12, queen.archetypes[queen.primaryArchetypeId].phases[2].telegraphSeconds)];
      const config = oneMarkedAttackConfig(trackMarksOf(marked, windows)!);
      const step = config.simulation.fixedStepSeconds;
      const real = simulatedVolleyTimes(config, 12);
      const drawn = timesOf(previewVolleysOf(marked, windows, 12, 1e9));
      expect(real.length).toBeGreaterThan(3);
      expect(drawn.length).toBe(real.length);
      drawn.forEach((time, index) => expect(Math.abs(real[index] - time)).toBeLessThanOrEqual(step));
    });
  }
});
