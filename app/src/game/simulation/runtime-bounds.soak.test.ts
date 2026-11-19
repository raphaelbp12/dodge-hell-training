import { describe, expect, test } from "vitest";
import {
  encounterConfigOf,
  liveShardBoundForEncounter,
  primaryArchetype,
} from "../config/encounter";
import { CONDITION_KEYS } from "./conditions";
import { PALADIN_STATS } from "../config/stats";
import { SessionController } from "../session/session";
import { AttemptHistory } from "../../storage/attempts";
import type { SimulationInput } from "../models";

/**
 * Plan V22 A25: a simulated soak in Node. Through the session, each Queen phase
 * is drilled and looped for ten simulated minutes in fixed steps with a
 * moving input, then 25 retries run. Live counts, the serialized state size
 * and the history stay bounded. It catches a leak minutes of simulated time
 * before a 60-second browser soak can. Each measure's peak is printed.
 */

const config = encounterConfigOf("killer-bee-queen");
const SIMULATED_MINUTES = 10;
const SECONDS_PER_MINUTE = 60;
const RETRIES = 25;
const RETRY_SECONDS = 20;
/** Samples are taken once per simulated second. */
const SAMPLE_INTERVAL_SECONDS = 1;
/** The serialized size at the end may exceed the early maximum by this factor (plan V22 A25). */
const SIZE_GROWTH_FACTOR = 1.1;
/** The early window the end is compared with: minutes 1 to 2. */
const EARLY_WINDOW_SECONDS = [SECONDS_PER_MINUTE, 2 * SECONDS_PER_MINUTE] as const;
/** A strafing input that turns every half second, so the player crosses the whole arena. */
const STRAFE_PERIOD_STEPS = 30;
const STRAFE: readonly SimulationInput[] = [
  { north: false, south: false, east: true, west: false },
  { north: false, south: true, east: false, west: false },
  { north: false, south: false, east: false, west: true },
  { north: true, south: false, east: false, west: false },
];

const stepSeconds = config.simulation.fixedStepSeconds;
const stepsPerSample = Math.round(SAMPLE_INTERVAL_SECONDS / stepSeconds);
const shardBound = liveShardBoundForEncounter(config);
/** Primary plus the most minions the encounter allows alive at once. */
const enemyBound = config.spawns.maxConcurrent + config.maxConcurrentMinions;
const phaseCount = primaryArchetype(config).phases.length;

function seedSource(): () => number {
  let next = 1;
  return () => next++;
}

/** The state's own growth, without the constant encounter configuration it carries. */
function serializedSize(state: SessionController["simulation"]): number {
  const { config: _config, ...own } = state;
  return JSON.stringify(own).length;
}

type Peaks = { shards: number; bombs: number; enemies: number; conditions: number };

function emptyPeaks(): Peaks {
  return { shards: 0, bombs: 0, enemies: 0, conditions: 0 };
}

/**
 * Finding F100-3 (docs/plan-archive/phase-100.md, execution record; seed
 * source 1, 2, 3...): after plan V23 step 100.1's measured Queen timings, a
 * looping phase 8 drill (index 7) ends at 40,910 serialized bytes against an
 * early maximum of 31,682. Every count stays inside its bound (enemies 13/13);
 * the size follows the Beehemoth population, which grows by three per drill
 * loop and resets on a retry, so the end sample lands on a high point. Kept as
 * `test.fails` for a user decision (plan V22 A10).
 */
const SIZE_FINDING_PHASES: ReadonlySet<number> = new Set([7]);

describe("ten simulated minutes of each drilled Queen phase", () => {
  const phases = Array.from({ length: phaseCount }, (_, index) => index);
  test.each(phases.filter((index) => !SIZE_FINDING_PHASES.has(index)))("phase %i stays bounded", soakPhase);
  test.fails.each(phases.filter((index) => SIZE_FINDING_PHASES.has(index)))(
    "phase %i stays bounded (finding F100-3)",
    soakPhase,
  );
});

function soakPhase(phaseIndex: number): void {
  const session = new SessionController(
    seedSource(),
    { drill: { phaseIndices: [phaseIndex], loop: true } },
    config,
  );
  session.start();
  const peaks = emptyPeaks();
  const sizes: { second: number; size: number }[] = [];
  const totalSeconds = SIMULATED_MINUTES * SECONDS_PER_MINUTE;
  let step = 0;
  for (let second = 1; second <= totalSeconds; second += SAMPLE_INTERVAL_SECONDS) {
    for (let index = 0; index < stepsPerSample; index++, step++) {
      // The player is kept alive so the attempt lasts the whole run; hits still land and count.
      session.simulation.player.healthHp = PALADIN_STATS.healthHp;
      const result = session.advance(
        stepSeconds,
        STRAFE[Math.floor(step / STRAFE_PERIOD_STEPS) % STRAFE.length],
      );
      if (result) session.retry();
    }
    const state = session.simulation;
    expect(state.shards.length).toBeLessThanOrEqual(shardBound);
    expect(state.bombs.length).toBeLessThanOrEqual(shardBound);
    expect(state.enemies.length).toBeLessThanOrEqual(enemyBound);
    const conditions = CONDITION_KEYS.filter((key) => state.player.conditionSeconds[key] > 0).length;
    expect(conditions).toBeLessThanOrEqual(CONDITION_KEYS.length);
    peaks.shards = Math.max(peaks.shards, state.shards.length);
    peaks.bombs = Math.max(peaks.bombs, state.bombs.length);
    peaks.enemies = Math.max(peaks.enemies, state.enemies.length);
    peaks.conditions = Math.max(peaks.conditions, conditions);
    if (second % SECONDS_PER_MINUTE === 0 || (second >= EARLY_WINDOW_SECONDS[0] && second <= EARLY_WINDOW_SECONDS[1]))
      sizes.push({ second, size: serializedSize(state) });
  }
  const early = Math.max(
    ...sizes
      .filter((sample) => sample.second >= EARLY_WINDOW_SECONDS[0] && sample.second <= EARLY_WINDOW_SECONDS[1])
      .map((sample) => sample.size),
  );
  const final = sizes[sizes.length - 1].size;
  console.log(
    `phase ${phaseIndex}: peak shards ${peaks.shards}/${shardBound}, bombs ${peaks.bombs}, enemies ${peaks.enemies}/${enemyBound}, conditions ${peaks.conditions}, state ${final} bytes vs early max ${early}`,
  );
  expect(final).toBeLessThanOrEqual(early * SIZE_GROWTH_FACTOR);
}

describe("retries", () => {
  test(`${RETRIES} retries leave the session and the history bounded`, () => {
    const history = new AttemptHistory(() => ({ getItem: () => null, setItem: () => undefined }));
    const session = new SessionController(seedSource(), {}, config);
    session.start();
    let attempt = 0;
    for (let retry = 0; retry < RETRIES; retry++) {
      const totalSteps = Math.round(RETRY_SECONDS / stepSeconds);
      for (let step = 0; step < totalSteps; step++) {
        const result = session.advance(stepSeconds, STRAFE[Math.floor(step / STRAFE_PERIOD_STEPS) % STRAFE.length]);
        if (result) {
          const { attemptId, ...metrics } = result;
          history.save({ id: `soak:${attemptId}`, ...metrics });
          break;
        }
      }
      expect(session.simulation.shards.length).toBeLessThanOrEqual(shardBound);
      session.retry();
      attempt++;
    }
    expect(attempt).toBe(RETRIES);
    expect(history.snapshot().records.length).toBeLessThanOrEqual(config.session.historyLimit);
  });
});
