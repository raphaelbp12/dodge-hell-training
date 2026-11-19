// Vitest reporter: fails the run when a node-project test used more than half of
// its own effective timeout, so a test that is one load spike from timing out is
// caught while it still passes (quality failures report 2026-11-18, item 2.8).
// Vitest accepts `reporters` only at the root, so the reporter filters by project.

/** Largest tolerated share of a test's timeout. */
export const SLOW_TEST_FRACTION = 0.5;

/** Project the rule applies to. */
const GUARDED_PROJECT = "node";

/**
 * Returns the tests whose duration exceeds the fraction of their timeout.
 * @param {{ name: string, duration: number, timeout: number }[]} tests durations and timeouts in milliseconds
 * @param {number} [fraction]
 */
export function findSlowTests(tests, fraction = SLOW_TEST_FRACTION) {
  return tests.filter((t) => t.timeout > 0 && t.duration > t.timeout * fraction);
}

/**
 * Decides what to print and whether to fail. On the hosted runner the budget is
 * advisory (a shared runner can be slow), so it warns; elsewhere it fails.
 * @param {{ name: string, duration: number, timeout: number }[]} slow
 * @param {boolean} onGitHubActions
 * @returns {{ text: string, fail: boolean }}
 */
export function decideSlowTestReport(slow, onGitHubActions) {
  if (slow.length === 0) return { text: "", fail: false };
  const lines = slow.map(
    (t) => `  ${Math.round(t.duration)} ms of ${t.timeout} ms: ${t.name}`,
  );
  let text = `\nSlow tests: ${slow.length} used more than ${SLOW_TEST_FRACTION * 100}% of their timeout. Speed them up or set an explicit { timeout } with the measured time.\n${lines.join("\n")}`;
  if (onGitHubActions) {
    text += `\n${slow
      .map((t) => `::warning title=Slow test::${Math.round(t.duration)} ms of ${t.timeout} ms: ${t.name}`)
      .join("\n")}`;
  }
  return { text, fail: !onGitHubActions };
}

export default class SlowTestReporter {
  onInit(vitest) {
    this.vitest = vitest;
  }

  onTestRunEnd(testModules) {
    const tests = [];
    for (const mod of testModules) {
      if (mod.project.name !== GUARDED_PROJECT) continue;
      for (const test of mod.children.allTests()) {
        const duration = test.diagnostic()?.duration;
        if (duration === undefined) continue;
        const timeout = test.options?.timeout ?? mod.project.config.testTimeout;
        tests.push({ name: test.fullName, duration, timeout });
      }
    }
    const { text, fail } = decideSlowTestReport(
      findSlowTests(tests),
      process.env.GITHUB_ACTIONS === "true",
    );
    if (text) console.error(text);
    if (fail) process.exitCode = 1;
  }
}
