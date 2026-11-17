// Turns a Stryker JSON report into a job summary and annotations, so a
// mutation run's result is read on the run page and in the pull request's
// diff instead of in a downloaded artifact.
//
// Usage: node scripts/mutation-summary.mjs <report.json> [<fallback.json>...] [--changed <changed-lines.json>]
//
// The first report path that exists is used. A later one is the incremental
// file, which Stryker also writes when a run is interrupted, so its summary is
// marked as partial. `--changed` takes the file `scripts/mutation-diff.mjs`
// writes and switches to the pull-request layout.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { shardOptions } from "../stryker.config.mjs";

const DETECTED = new Set(["Killed", "Timeout"]);

/** Most mutants listed one by one; the rest are counted. */
const LIST_LIMIT = 40;

/** GitHub shows at most ten warning annotations for one step. */
const ANNOTATION_LIMIT = 10;

function scoreOf(detected, undetected) {
  return detected + undetected === 0 ? null : (100 * detected) / (detected + undetected);
}

/**
 * Counts per file and overall, and every survived or uncovered mutant.
 * `changed` maps a file to its changed `[first, last]` line ranges; a mutant
 * that starts inside one is marked `onChangedLine`.
 */
export function summarize(report, changed = null) {
  const files = [];
  const undetectedMutants = [];
  for (const [file, { mutants }] of Object.entries(report.files)) {
    const counts = { file, detected: 0, survived: 0, notCovered: 0 };
    const ranges = changed?.[file] ?? [];
    for (const mutant of mutants) {
      if (DETECTED.has(mutant.status)) {
        counts.detected++;
        continue;
      }
      if (mutant.status === "Survived") counts.survived++;
      else if (mutant.status === "NoCoverage") counts.notCovered++;
      else continue;
      const line = mutant.location.start.line;
      undetectedMutants.push({
        file,
        line,
        status: mutant.status,
        mutator: mutant.mutatorName,
        replacement: mutant.replacement ?? "",
        onChangedLine: ranges.some(([first, last]) => line >= first && line <= last),
      });
    }
    if (counts.detected + counts.survived + counts.notCovered > 0)
      files.push({ ...counts, score: scoreOf(counts.detected, counts.survived + counts.notCovered) });
  }
  files.sort((a, b) => a.score - b.score || a.file.localeCompare(b.file));
  undetectedMutants.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const detected = files.reduce((sum, file) => sum + file.detected, 0);
  const undetected = undetectedMutants.length;
  return { files, undetectedMutants, detected, undetected, score: scoreOf(detected, undetected) };
}

function firstLine(text) {
  const line = text.split("\n")[0].trim();
  return line.length > 60 ? `${line.slice(0, 60)}...` : line;
}

function describe(entry) {
  return entry.status === "NoCoverage"
    ? `${entry.mutator}, not covered by any test`
    : `${entry.mutator} survived as \`${firstLine(entry.replacement)}\``;
}

/**
 * The Markdown for the job summary. `breakAt` is the score the run breaks
 * below, when it has one; `changed` selects the pull-request layout, which
 * lists the undetected mutants on changed lines.
 */
export function formatSummary(summary, { title, breakAt = null, changed = false, listLimit = LIST_LIMIT }) {
  const lines = [`### Mutation tests: ${title}`, ""];
  if (summary.score === null) return [...lines, "No mutant was tested."].join("\n");
  const total = summary.detected + summary.undetected;
  let verdict = "";
  if (breakAt !== null)
    verdict = summary.score < breakAt ? `, below the break value of ${breakAt}` : `, break value ${breakAt}`;
  lines.push(`**Score ${summary.score.toFixed(1)}%** (${summary.detected} of ${total} mutants detected)${verdict}`, "");
  lines.push("| File | Score | Survived | Not covered |", "| --- | --- | --- | --- |");
  for (const file of summary.files)
    lines.push(`| \`${file.file}\` | ${file.score.toFixed(1)}% | ${file.survived} | ${file.notCovered} |`);
  if (!changed) return lines.join("\n");
  const onChanged = summary.undetectedMutants.filter((entry) => entry.onChangedLine);
  lines.push("");
  if (onChanged.length === 0) lines.push("No undetected mutant on the lines this pull request changed.");
  else {
    lines.push(`#### Undetected on lines this pull request changed (${onChanged.length})`, "");
    for (const entry of onChanged.slice(0, listLimit)) lines.push(`- \`${entry.file}:${entry.line}\` ${describe(entry)}`);
    if (onChanged.length > listLimit)
      lines.push("", `${onChanged.length - listLimit} more are in the mutation report artifact.`);
  }
  const elsewhere = summary.undetected - onChanged.length;
  if (elsewhere > 0)
    lines.push(
      "",
      `${elsewhere} more undetected mutants are on lines this pull request did not change; the mutation report artifact lists them.`,
    );
  return lines.join("\n");
}

/**
 * Workflow commands that mark survivors on changed lines in the pull
 * request's diff. Uncovered mutants are left to the summary: a line no test
 * runs is better read there than as one warning per mutant.
 */
export function annotations(summary, limit = ANNOTATION_LIMIT) {
  return summary.undetectedMutants
    .filter((entry) => entry.onChangedLine && entry.status === "Survived")
    .slice(0, limit)
    .map(
      (entry) =>
        `::warning file=app/${entry.file},line=${entry.line},title=Mutant survived::` +
        `${entry.mutator} replaced this code with \`${firstLine(entry.replacement).replaceAll("%", "%25")}\` and no test failed`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const changedIndex = args.indexOf("--changed");
  const changedPath = changedIndex === -1 ? null : args[changedIndex + 1];
  const reportPaths = args.filter((arg, index) => arg !== "--changed" && (changedIndex === -1 || index !== changedIndex + 1));
  const used = reportPaths.findIndex((path) => existsSync(path));
  if (used === -1) {
    console.log("No mutation report to summarize.");
    process.exit(0);
  }
  const changed = changedPath && existsSync(changedPath) ? JSON.parse(readFileSync(changedPath, "utf8")) : null;
  const summary = summarize(JSON.parse(readFileSync(reportPaths[used], "utf8")), changed);
  const shard = process.env.MUTATION_SHARD;
  const partial = used > 0 ? " (partial: the run did not finish, these are the results saved so far)" : "";
  const text = formatSummary(summary, {
    title: `${shard ? `shard ${shard}` : "changed modules"}${partial}`,
    // An unfinished run was never held to its break value.
    breakAt: used > 0 ? null : (shardOptions(shard).thresholds?.break ?? null),
    changed: changed !== null,
  });
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  if (changed !== null) for (const line of annotations(summary)) console.log(line);
}
