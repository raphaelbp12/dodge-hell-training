import { afterEach, expect, test, vi } from "vitest";
import { propertyParameters, SIMULATION_PROPERTY_RUNS } from "./property";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("defaults to 100 runs and no fixed seed", () => {
  vi.stubEnv("FC_SEED", "");
  vi.stubEnv("FC_NUM_RUNS", "");
  const parameters = propertyParameters();
  expect(parameters.numRuns).toBe(100);
  expect(parameters).not.toHaveProperty("seed");
});

test("reads the seed and run count from the environment", () => {
  vi.stubEnv("FC_SEED", "1234");
  vi.stubEnv("FC_NUM_RUNS", "7");
  expect(propertyParameters()).toMatchObject({ seed: 1234, numRuns: 7 });
});

test("overrides win over the environment", () => {
  vi.stubEnv("FC_SEED", "1234");
  vi.stubEnv("FC_NUM_RUNS", "7");
  expect(propertyParameters({ numRuns: SIMULATION_PROPERTY_RUNS, seed: 9 })).toMatchObject({
    seed: 9,
    numRuns: SIMULATION_PROPERTY_RUNS,
  });
});

test("rejects a non-integer environment value", () => {
  vi.stubEnv("FC_NUM_RUNS", "many");
  expect(() => propertyParameters()).toThrow(RangeError);
});
