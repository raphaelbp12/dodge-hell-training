import { expect, test } from "vitest";
import { annotations, blockingAnnotations, blockingMutants, formatSummary, summarize } from "./mutation-summary.mjs";

function mutant(status, line, mutatorName = "ConditionalExpression", replacement = "false") {
  return { status, mutatorName, replacement, location: { start: { line, column: 1 }, end: { line, column: 9 } } };
}

const REPORT = {
  files: {
    "src/storage/attempts.ts": {
      mutants: [mutant("Killed", 3), mutant("Timeout", 4), mutant("Survived", 10), mutant("Ignored", 11)],
    },
    "src/research/study.ts": {
      mutants: [mutant("Killed", 1), mutant("NoCoverage", 20, "BlockStatement", "{}"), mutant("Survived", 40)],
    },
  },
};

test("the score counts killed and timed out mutants against survivors and uncovered ones, ignoring the rest", () => {
  const summary = summarize(REPORT);
  expect(summary.detected).toBe(3);
  expect(summary.undetected).toBe(3);
  expect(summary.score).toBe(50);
  expect(summary.files).toEqual([
    { file: "src/research/study.ts", detected: 1, survived: 1, notCovered: 1, score: 100 / 3 },
    { file: "src/storage/attempts.ts", detected: 2, survived: 1, notCovered: 0, score: (100 * 2) / 3 },
  ]);
});

test("a report with no tested mutant has no score", () => {
  expect(summarize({ files: { "src/a.ts": { mutants: [mutant("Ignored", 1)] } } }).score).toBeNull();
});

test("without changed lines no undetected mutant is marked as on a changed line", () => {
  expect(summarize(REPORT).undetectedMutants.every((entry) => !entry.onChangedLine)).toBe(true);
});

test("an undetected mutant is on a changed line when its first line falls inside a changed range of its file", () => {
  const summary = summarize(REPORT, { "src/research/study.ts": [[18, 22]], "src/storage/attempts.ts": [[1, 9]] });
  expect(summary.undetectedMutants.filter((entry) => entry.onChangedLine)).toEqual([
    { file: "src/research/study.ts", line: 20, status: "NoCoverage", mutator: "BlockStatement", replacement: "{}", onChangedLine: true },
  ]);
});

test("the summary states the score, the break value and whether the score is below it", () => {
  const text = formatSummary(summarize(REPORT), { title: "shard state", breakAt: 83 });
  expect(text).toContain("### Mutation tests: shard state");
  expect(text).toContain("**Score 50.0%** (3 of 6 mutants detected), below the break value of 83");
  expect(formatSummary(summarize(REPORT), { title: "x", breakAt: 40 })).toContain("break value 40");
  expect(formatSummary(summarize(REPORT), { title: "x" })).not.toContain("break");
});

test("the summary lists each file with its score, worst first", () => {
  const text = formatSummary(summarize(REPORT), { title: "x" });
  expect(text).toContain("| `src/research/study.ts` | 33.3% | 1 | 1 |");
  expect(text.indexOf("study.ts")).toBeLessThan(text.indexOf("attempts.ts"));
});

test("with changed lines, the summary lists the undetected mutants on them and counts the rest", () => {
  const changed = { "src/research/study.ts": [[18, 22]] };
  const text = formatSummary(summarize(REPORT, changed), { title: "x", changed: true });
  expect(text).toContain("#### Undetected on lines this pull request changed (1)");
  expect(text).toContain("- `src/research/study.ts:20` BlockStatement, not covered by any test");
  expect(text).toContain("2 more undetected mutants are on lines this pull request did not change");
});

test("with changed lines and nothing undetected on them, the summary says so", () => {
  const text = formatSummary(summarize(REPORT, {}), { title: "x", changed: true });
  expect(text).toContain("No undetected mutant on the lines this pull request changed.");
});

test("a list longer than the limit is cut and says how many were left out", () => {
  const mutants = Array.from({ length: 5 }, (_, index) => mutant("Survived", index + 1));
  const summary = summarize({ files: { "src/a.ts": { mutants } } }, { "src/a.ts": [[1, 5]] });
  const text = formatSummary(summary, { title: "x", changed: true, listLimit: 2 });
  expect(text.match(/^- `/gm)).toHaveLength(2);
  expect(text).toContain("3 more are in the mutation report artifact");
});

test("annotations name the repository path and line of each undetected mutant on a changed line, up to the limit", () => {
  const mutants = [mutant("Survived", 7, "EqualityOperator", "a >= b\n&& c"), mutant("Survived", 8), mutant("Survived", 99)];
  const summary = summarize({ files: { "src/a.ts": { mutants } } }, { "src/a.ts": [[1, 10]] });
  expect(annotations(summary)).toEqual([
    "::warning file=app/src/a.ts,line=7,title=Mutant survived::EqualityOperator replaced this code with `a >= b` and no test failed",
    "::warning file=app/src/a.ts,line=8,title=Mutant survived::ConditionalExpression replaced this code with `false` and no test failed",
  ]);
  expect(annotations(summary, 1)).toHaveLength(1);
});

const GATE_REPORT = {
  files: {
    "src/a.ts": { mutants: [mutant("NoCoverage", 5, "BlockStatement", "{}"), mutant("NoCoverage", 50), mutant("Survived", 6)] },
  },
};

test("a NoCoverage mutant on a changed line blocks; on an unchanged line it does not", () => {
  const blocking = blockingMutants(summarize(GATE_REPORT, { "src/a.ts": [[1, 10]] }));
  expect(blocking.map((entry) => [entry.line, entry.status])).toEqual([[5, "NoCoverage"]]);
  expect(blockingMutants(summarize(GATE_REPORT, { "src/a.ts": [[40, 60]] })).map((entry) => entry.line)).toEqual([50]);
  expect(blockingMutants(summarize(GATE_REPORT, { "src/a.ts": [[20, 30]] }))).toEqual([]);
});

test("a Survived mutant on a changed line does not block and still gets its warning", () => {
  const summary = summarize({ files: { "src/a.ts": { mutants: [mutant("Survived", 6)] } } }, { "src/a.ts": [[1, 10]] });
  expect(blockingMutants(summary)).toEqual([]);
  expect(blockingAnnotations(summary)).toEqual([]);
  expect(annotations(summary)).toEqual([expect.stringMatching(/^::warning file=app\/src\/a\.ts,line=6,title=Mutant survived::/)]);
});

test("a summary without changed-line data blocks nothing", () => {
  expect(blockingMutants(summarize(GATE_REPORT))).toEqual([]);
  expect(blockingAnnotations(summarize(GATE_REPORT))).toEqual([]);
});

test("blocking annotations are errors naming the repository path and line, up to the limit", () => {
  const summary = summarize(GATE_REPORT, { "src/a.ts": [[1, 60]] });
  expect(blockingAnnotations(summary)[0]).toMatch(/^::error file=app\/src\/a\.ts,line=5,title=Changed line not covered::/);
  expect(blockingAnnotations(summary, 1)).toHaveLength(1);
});

test("the pull-request summary lists blocking mutants under a heading that says they block the merge", () => {
  const text = formatSummary(summarize(GATE_REPORT, { "src/a.ts": [[1, 10]] }), { title: "x", changed: true });
  expect(text).toContain("#### Blocks the merge: changed lines no test runs (1)");
  expect(formatSummary(summarize(GATE_REPORT, {}), { title: "x", changed: true })).not.toContain("Blocks the merge");
});
