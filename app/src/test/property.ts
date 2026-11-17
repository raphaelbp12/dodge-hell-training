/**
 * Shared run configuration for fast-check property tests (plan V22 A06).
 *
 * Replaying a failure: fast-check prints the failing `seed` and `path`. Run
 * `FC_SEED=<seed> npx vitest run <file>` to reproduce the same generated
 * values, and add `{ path: "<path>" }` to the `propertyParameters` call of the
 * failing property to jump straight to the shrunk counterexample. `FC_NUM_RUNS`
 * overrides the run count. CI draws a fresh seed on every run.
 *
 * Test-only module: no React, Phaser or DOM imports.
 */
import type { Parameters } from "fast-check";

const DEFAULT_RUNS = 100;

/**
 * Runs per whole-simulation property. A runtime budget for the slow
 * properties, not a gameplay value.
 */
export const SIMULATION_PROPERTY_RUNS = 25;

function integerFromEnvironment(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value))
    throw new RangeError(`${name} must be an integer, got "${raw}"`);
  return value;
}

/** fast-check parameters from `FC_SEED` and `FC_NUM_RUNS`; `overrides` apply last. */
export function propertyParameters<T>(
  overrides: Parameters<T> = {},
): Parameters<T> {
  const seed = integerFromEnvironment("FC_SEED");
  const numRuns = integerFromEnvironment("FC_NUM_RUNS") ?? DEFAULT_RUNS;
  return { ...(seed === undefined ? {} : { seed }), numRuns, ...overrides };
}
