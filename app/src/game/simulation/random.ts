/**
 * Deterministic random source for the simulation.
 *
 * Spawn placement needs variety, but the fixed-step loop may execute several
 * steps in one update, so a draw must not depend on wall-clock time or frame
 * pacing (G13). The generator is therefore a pure function of a numeric seed
 * that the simulation carries and advances itself.
 *
 * A seed rather than an injected object, because `SimulationState` is
 * `structuredClone`d for diagnostics and must stay plain serializable data: a
 * stored closure throws `DataCloneError`. Callers get reproducibility by
 * passing an explicit seed to `createSimulation`.
 */

const seedIncrement = 0x9e3779b1;
const shift1 = 15;
const shift2 = 7;
const shift3 = 14;
const unitScale = 4294967296;

export function assertSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError("Seed must be finite");
  return Math.trunc(seed) >>> 0;
}

/** Advances the generator state (mulberry32). */
export function nextSeed(seed: number): number {
  return (seed + seedIncrement) >>> 0;
}

/** Maps a generator state to a value in [0, 1). */
export function unitFromSeed(seed: number): number {
  let value = seed >>> 0;
  value = Math.imul(value ^ (value >>> shift1), 1 | value);
  value = (value + Math.imul(value ^ (value >>> shift2), 61 | value)) ^ value;
  return ((value ^ (value >>> shift3)) >>> 0) / unitScale;
}

/** A seed derived from the host, for attempts that do not pin one. */
export function arbitrarySeed(): number {
  return assertSeed(Math.random() * unitScale);
}
