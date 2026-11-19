# Trust Plan, 2026-11-19

This plan raises trust in the code this repository produces by making the existing gates enforced and believable, rather than by adding more tests. It covers six work items chosen by the user on 2026-11-19. Nothing here is implemented yet. It is written for a session that has not seen the analysis behind it, so every item states its evidence, its steps and its acceptance criteria.

It is a standalone document in the style of [the quality failures report](quality-failures-report-2026-11-18.md). It is **not** registered as a plan version in `implementation-plan.md`: plan V23 and phase 100 are still in the unmerged pull request #12, so a new plan number would collide with it. The identifiers `T1` to `T6` and `AC<item>.<n>` below are local to this file and are not plan decision IDs.

[The project instructions](../AGENTS.md) bind all of this work: write a failing test first, change files with the Write and Edit tools, delegate `npm run verify` to the `verifier` subagent, and never commit, push or merge without the user's authorization.

## Evidence (collected 2026-11-19)

- `main` has been red since 2026-11-18 19:05 UTC. Run 44376706799, job `Unit Tests`, fails with "Slow tests: 1 used more than 50% of their timeout" on "the Killer Bee Queen's eight phases carry phases 1, 3, 4, 6 and 8's attacks and drain on the approved timeline" (30,000 ms timeout). The same commit passed as pull request #11 one minute earlier, so the result depends on the speed of the hosted runner. The `deploy` job needs `checks`, so a red `Unit Tests` holds the deployment back.
- Pull request #13 fails the same budget (two tests) and `Browser Tests (soak 1/1)`. Pull request #12 fails `Browser Tests (main 3/3)`. Neither browser failure has been diagnosed, and neither is part of this plan.
- `main` has no branch protection: `gh api repos/raphaelbp12/dodge-hell-training/branches/main/protection` returns 404. The command in the failures report, section 1a item 12, was never run.
- `.github/workflows/pages.yml` starts no run for a pull request that changes only Markdown or `.claude/**` (`paths-ignore`). A required check that never runs stays pending for ever, so branch protection would make such a pull request unmergeable.
- The `rtk` `PreToolUse` hook rewrites Bash commands (`npm run verify` becomes `rtk npm run verify`). Auto mode then refuses the rewritten call until it is issued again. The failures report, section 3, records that subagents did not re-issue, so their checks were partial.
- Tested on rtk 1.1.0 with a scratch copy of the configuration: `exclude_commands = ["npm", "npx"]` in the **existing** `[hooks]` section of `~/.config/rtk/config.toml` makes `rtk rewrite` exit 1 with no output for `npm run verify`, `cd app && npm run verify`, `CI=true npm run test:e2e -- --grep "x"`, `npm run test:mutation:diff`, `npx oxlint --fix`, `npx vitest run a.test.ts`, `npx tsc -b` and `npx playwright test`, while `git status` and `grep -n a b` are still rewritten (exit 3). A second `[hooks]` header makes the file fail to parse ("duplicate key `hooks` in document root") and rtk then silently uses its defaults. rtk honours `XDG_CONFIG_HOME`, which makes the configuration testable in a temporary directory.
- `~/.config` is a named volume (`user-config-${devcontainerId}`), so a manual edit survives a rebuild of this container but not a new container.
- The three benchmark calibration runs on record (2026-11-17, runs 44183948084, 44183953428 and 44183958126) predate the batched benchmarks `advance-shard-x1000` and `swept-overlap-x1000`. The `config` mutation shard's score after the 2026-11-18 tests is unmeasured, and the three new `simulation-*` shards have estimated break values only. Scheduled mutation run 44543968705 started on 2026-11-19 at 14:27 UTC and was still in progress when this plan was written.
- Every gate is a test or lint rule written by the same agent that wrote the code under test. No step has a second reader.
- The pull-request mutation run (`.github/workflows/mutation-diff.yml`) never fails on a finding (plan V22 A17). `app/scripts/mutation-summary.mjs` already marks each undetected mutant with `onChangedLine` and its status, `Survived` or `NoCoverage`.

## Decisions taken as defaults

Each default is the smaller choice. Confirm or change them with the user before starting the item they belong to.

| ID | Decision | Default | Alternative |
| -- | -------- | ------- | ----------- |
| T1 | Commands rtk must not rewrite | `npm`, `npx`, `git`. The first two are everything the `verifier` runs. `git` is included because `commit-drafter` reads the diff, and rtk's condensed `git diff` removes most of it. The main session can still type `rtk git ...` itself. | `npm` and `npx` only, and tell `commit-drafter` to type `rtk git`. |
| T2 | Required status checks on `main` | `Lint`, `Typecheck`, `Unit Tests`, `Build`, on an up-to-date branch, admins not enforced. | Add `Simulated Soak`, and the four `Browser Tests (...)` checks once their flake rate is known. |
| T3 | Pull requests that change only Markdown or `.claude/**` | Remove `paths-ignore` from the `pull_request` trigger of `pages.yml`, so the required checks always report. The `push` trigger keeps it. | Keep the filter and merge such pull requests with `gh pr merge --admin`. |
| T4 | How the slow-test reporter detects the hosted runner | `process.env.GITHUB_ACTIONS === "true"`, as `mutation-diff.mjs` already does for its warnings. | `process.env.CI`, which the verifier also sets locally for Playwright. |
| T5 | Whether the pull-request mutation job becomes a required check | No. Its job fails and shows red, and the instruction in `AGENTS.md` forbids merging over it. Making it required would need the workflow to run on every pull request and would add up to 30 minutes to each merge. | Remove the workflow's `paths` filter and add `Mutation Of Changed Files` to the required contexts. |
| T6 | Independent review | A session that did not write the change runs `/code-review high <pull request number> --comment`. It reports and does not fix. | A CI job that runs the review; it needs an API secret in the repository. |

## Order

`main` must be green before branch protection is turned on, or every pull request is blocked.

1. **Pull request A** (new branch from `main`): item 1 and step 2.1. This turns `main` green.
2. **Pull request #14** (the existing branch `devcontainer-claude-updates`): item 3.
3. **User, own terminal**: step 2.2 (branch protection), after pull request A is merged and its run on `main` is green. Item 4's three calibration dispatches can be started at any time.
4. **Pull request B** (new branch from `main`): items 5 and 6.
5. **Pull request C** or a commit on pull request B: item 4's recorded numbers, once the runs have finished.
6. Pull requests #12 and #13 merge `main` into their branches after pull request A, so they pick up the fix.

## Relation to pull request #15

Pull request #15 (`agent-context-budget`, open on 2026-11-19) adds a "Context budget" section to `AGENTS.md`, an orchestration rule to `/implement-phase`, and named files for the diff run (`npm run test:mutation:diff -- <files>`). It is compatible with this plan and merges after pull request A and before pull request B, because it and pull request B both edit `AGENTS.md` and `docs/quality-gates.md`. Where its first commit and this plan disagreed, this plan won (user decision, 2026-11-19), and the branch was amended on 2026-11-19 as follows. With the amendments merged, this plan runs as `/implement-phase docs/trust-plan-2026-11-19.md`.

- **Repository path.** The subagent brief in the first commit, and line 8 of `.claude/agents/verifier.md` on `main`, named `/workspaces/dodge-1`. The devcontainer mounts the repository at `/workspaces/<folder name>`, and in this container that is `/workspaces/dodge-2`; `/workspaces/dodge-1` does not exist. Both now take the root from the caller, who reads it from `git rev-parse --show-toplevel`.
- **More than four changed modules.** The first commit told the agent to "name the ones that matter", which lets the author choose which of its own modules are checked. The diff run now covers every changed module in the mutate globs, in consecutive batches of at most `DIFF_MODULE_LIMIT` named files.
- **Who verifies.** A subagent cannot start another subagent, so a phase subagent cannot delegate to the `verifier` as step 6 of the skill asks. The orchestrator runs the `verifier` after each phase or item, and the implementing subagent runs only its focused tests and `npx tsc -b`.
- **No questions.** An orchestrated run never asks the user. It takes the smaller option for a choice the plan leaves open, repairs a failed check itself in at most two rounds, sets a unit that still fails aside in a stash, and marks as `blocked` anything that is the user's alone to decide. It commits locally and never pushes. In this plan, steps 2.2 and 4.1, item 4's steps 2 to 4, and criteria AC1.5, AC2.2 to AC2.4 and AC5.4 therefore end under "Needs you".
- **Who approves.** The implementing subagent's report is a claim, not evidence. Acceptance is decided by the new read-only `critic` subagent (`.claude/agents/critic.md`), which receives the plan and the base ref and never the implementer's report, for at most two fix rounds.

## Item 1 - The slow-test budget warns on the hosted runner and fails locally

**Goal.** A wall-clock limit must not turn `main` red because a shared runner was slow. A real timeout still fails everywhere.

**Files.** `app/scripts/slow-test-reporter.mjs`, `app/scripts/slow-test-reporter.test.mjs`, `docs/quality-gates.md` ("Slow-test budget").

**Steps.**

1. Move the decision out of `onTestRunEnd` into an exported pure function that takes the slow tests and whether the run is on GitHub Actions (T4), and returns the text to print and whether to fail. Write its tests first.
2. On GitHub Actions: print the existing message, print one `::warning title=Slow test::<duration> ms of <timeout> ms: <name>` workflow command per slow test, and leave `process.exitCode` alone.
3. Anywhere else: keep today's behaviour, the message on stderr and `process.exitCode = 1`.
4. Rewrite the "Slow-test budget" section of `docs/quality-gates.md` to describe both behaviours and the reason (run 44376706799), dated.

**Accepted limit.** On the hosted runner the budget is advisory. A slow test is still caught locally and by its real timeout.

**Acceptance.**

- AC1.1 New tests in `slow-test-reporter.test.mjs` cover three cases and were seen failing first: a slow test on GitHub Actions gives a `::warning` line and no failure; a slow test elsewhere gives a failure; no slow test gives no output and no failure in both.
- AC1.2 With a temporary node-project test that sleeps past half of its own timeout, `npx vitest run --project node <file>` exits 1, and the same command with `GITHUB_ACTIONS=true` exits 0 and prints the `::warning` line. The temporary test is deleted afterwards.
- AC1.3 `findSlowTests` and `SLOW_TEST_FRACTION` are unchanged, and no test timeout was raised to make a run pass.
- AC1.4 `npm run verify` passes from `app/`.
- AC1.5 After the merge, the `Validate And Deploy Pages` run on `main` concludes `success`, including `Unit Tests` and the deployment job. The user confirms this, or the agent checks once when asked; the agent does not poll.

## Item 2 - Branch protection on `main`

**Goal.** A red required check or a stale branch blocks a merge.

**Files.** `.github/workflows/pages.yml`, `docs/quality-failures-report-2026-11-18.md` (section 1a, item 12).

**Steps.**

1. (Agent, in pull request A.) Per T3, remove `paths-ignore` from the `pull_request` trigger of `pages.yml` and correct the comment above it. Leave the `push` trigger as it is.
2. (User, own terminal, after pull request A is merged and green. An agent session was refused this action on 2026-11-18, so the agent hands the command over and does not try it.)

   ```sh
   gh api -X PUT repos/raphaelbp12/dodge-hell-training/branches/main/protection --input - <<'EOF'
   {"required_status_checks":{"strict":true,"contexts":["Lint","Typecheck","Unit Tests","Build"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}
   EOF
   ```

3. (Agent.) Mark item 12 in section 1a of the failures report as done, with the date.

**Acceptance.**

- AC2.1 In `pages.yml`, `on.pull_request` has no path filter and `on.push` still ignores `**/*.md` and `.claude/**`.
- AC2.2 `gh api repos/raphaelbp12/dodge-hell-training/branches/main/protection --jq '.required_status_checks | {strict, contexts}'` prints `strict: true` and the four contexts of T2.
- AC2.3 A pull request that changes only a Markdown file gets all four required checks reported and can be merged without `--admin`.
- AC2.4 A pull request whose `Unit Tests` check is red, or whose branch is behind `main`, reports `mergeStateStatus` `BLOCKED` or `BEHIND` from `gh pr view <number> --json mergeStateStatus`.
- AC2.5 The failures report no longer lists item 12 as waiting for the command.

## Item 3 - rtk leaves verification and commit commands alone

**Goal.** The `verifier` and `commit-drafter` subagents run their commands without the hook changing them, so auto mode never refuses them and a reported check is a check that ran.

**Files.** A new `.devcontainer/configure-rtk.sh`, `.devcontainer/Dockerfile` (a `COPY` beside the other scripts, lines 57 to 60), `.devcontainer/devcontainer.json` (`postCreateCommand`, after `rtk init`), `.devcontainer/README.md` (the RTK paragraph).

**Steps.**

1. Write `configure-rtk.sh`. It finds `${XDG_CONFIG_HOME:-$HOME/.config}/rtk/config.toml`, creates the default file when it is missing (check first that `rtk config --create` does not overwrite an existing file), and sets the `exclude_commands` line inside the existing `[hooks]` section to the list of T1. It never appends a second `[hooks]` header. Like `install-claude-plugins.sh`, it prints a warning and exits 0 when it cannot do its work, so the container still starts.
2. Copy it into the image and call it from `postCreateCommand` after `rtk init -g --hook-only --auto-patch --no-trust-filters`.
3. Run it once by hand in the current container, which will not be rebuilt for this.
4. Document the list, the reason and the duplicate-header trap in the README.

**Acceptance.** Run AC3.1 to AC3.3 against a temporary `XDG_CONFIG_HOME` first, then against the real configuration.

- AC3.1 `rtk rewrite "npm run verify"`, `rtk rewrite "cd app && npm run verify"`, `rtk rewrite "npx tsc -b"`, `rtk rewrite "CI=true npm run test:e2e -- --grep x"` and `rtk rewrite "git diff"` each print nothing and exit 1.
- AC3.2 `rtk rewrite "grep -n a b"` still prints `rtk grep -n a b`.
- AC3.3 Running the script twice leaves exactly one `[hooks]` header and one `exclude_commands` line, and `rtk config` prints no parse error. Starting from a missing file also ends with a valid configuration.
- AC3.4 In an auto-mode session, the `verifier` subagent completes `npm run verify` and the `commit-drafter` subagent reads a diff, and neither transcript contains "a hook changed this call's input".
- AC3.5 The README states the excluded commands and why.

## Item 4 - Replace estimated and stale thresholds with measured ones

**Goal.** Every break value and threshold in the quality gates comes from a finished, dated run.

**Files.** `docs/quality-gates.md` ("Benchmarks", "Mutation baseline"), `app/stryker.config.mjs` (`MUTATION_SHARDS`), `app/scripts/bench-gate.mjs` (`BENCH_REGRESSION_THRESHOLD`, only if the rule below changes it), `docs/quality-failures-report-2026-11-18.md` (section 1a, items 1 and 2).

**Steps.**

1. (User, own terminal; dispatching from an agent session was refused on 2026-11-18.) Run `gh workflow run bench-calibrate.yml --ref main` three times.
2. (Agent, once the runs finish.) Read each run's worst base-against-base difference and each benchmark's rme from its job summary. Apply plan V22 A24: the threshold is the larger of 20 percent and three times the worst difference. Record the three run IDs, the date and the numbers in "Benchmarks", and delete the sentence that says the calibration must be re-run.
3. (Agent.) Read each shard's score from the job summaries of run 44543968705, or of the next scheduled or manually dispatched run when a shard ended partial. Record the six scores, the run ID and the date in "Mutation baseline". Per plan V22 A18, set each shard's `break` to floor(score) minus 5, with a comment that cites the run. Use only a shard that finished; a partial score sets nothing.
4. (Agent.) Update items 1 and 2 in section 1a of the failures report.

**Stop conditions.** A calibration that fails because an rme is above `BENCH_MAX_RME_PERCENT`, or a shard that scores below its current break, is a finding. Record it and stop for a user decision. Never lower a break to pass.

**Acceptance.**

- AC4.1 "Benchmarks" names three calibration runs dated after 2026-11-18, their worst differences and the resulting threshold, and no longer says a re-run is owed.
- AC4.2 "Mutation baseline" gives a dated score from a finished run, with its run ID, for each of `config`, `simulation-core`, `simulation-main`, `simulation-rules`, `research` and `state`.
- AC4.3 Every `break` in `MUTATION_SHARDS` equals floor(recorded score) minus 5, and no comment in `stryker.config.mjs` calls a break an estimate.
- AC4.4 `npm run verify` passes, including `scripts/mutation-shards.test.mjs` and `scripts/bench-gate.test.mjs`.
- AC4.5 Items 1 and 2 in section 1a of the failures report carry no "still to do" or "unmeasured" note.

## Item 5 - An independent review before every merge

**Goal.** A reader that did not write the change, and does not share the writing session's context, looks at it before it reaches `main`.

**Files.** `AGENTS.md` ("Git and deployment"), `.github/pull_request_template.md`. `CLAUDE.md` stays a bare import.

**Steps.**

1. Add the rule to `AGENTS.md`: a pull request that changes `app/` or `.github/workflows/` is merged only after a session that did not author it has run `/code-review high <number> --comment`. The reviewing session reports findings and does not edit the branch. The authoring session fixes each finding or records why it is declined. Prefer a different model from the author's when one is available.
2. Add an "Independent review" section to the pull request template: reviewing model, date, number of findings, and for each finding "fixed" or "declined" with the reason.
3. Run the planted-defect trial of AC5.3 once and report its result to the user.

**Not included.** Running the review in CI (T6), and a required-approval rule on GitHub, which a single-owner repository cannot satisfy for its own pull requests.

**Acceptance.**

- AC5.1 `AGENTS.md` holds the rule in one place, and `CLAUDE.md` is unchanged.
- AC5.2 The pull request template has the section with the four fields.
- AC5.3 Planted-defect trial. On a scratch branch that is never pushed, introduce one behavioural defect that leaves `npm run verify` green, for example in `app/src/game/phaser/`, which has no coverage floor and no mutation run. A fresh session runs `/code-review high` on that diff. Record in pull request B's description what was planted and whether the review reported it. A miss is a finding for the user, not something to hide by retrying until it passes.
- AC5.4 Pull request #13 is the first real use: a session that did not write it posts its review, visible with `gh pr view 13 --comments`, and the pull request's description gains the filled-in section.

## Item 6 - A changed line that no test runs fails the pull-request mutation job

**Goal.** New or edited code in a mutated module cannot merge with no test executing it. This is an approved deviation from plan V22 A17 (user decision, 2026-11-19); record it as such in `docs/quality-gates.md`.

**Scope of the block.** Only mutants with status `NoCoverage` on lines the pull request changed. Mutants that `Survived` stay warnings, because some are equivalent and would fail a correct change.

**Files.** `app/scripts/mutation-summary.mjs`, `app/scripts/mutation-summary.test.mjs`, `.github/workflows/mutation-diff.yml` (header comment only), `docs/quality-gates.md` ("Mutation tests", pull-request run), `.github/pull_request_template.md` (the mutation line), `.claude/agents/verifier.md`, `AGENTS.md` (one sentence in "Verification").

**Steps.**

1. Tests first, then an exported pure function in `mutation-summary.mjs` that returns the `NoCoverage` entries with `onChangedLine` from a summary.
2. In the pull-request layout (`--changed` given), `formatSummary` lists those entries under a heading that says they block the merge.
3. In the command-line block, when `--changed` is given and the list is not empty, print one `::error file=app/<file>,line=<line>,title=Changed line not covered::...` per entry, up to `ANNOTATION_LIMIT`, and set a nonzero exit code. The scheduled layout, without `--changed`, never fails on this.
4. Update the comment at the top of `mutation-diff.yml`, which says a finding never fails the job, and the "Pull-request run" paragraph of `docs/quality-gates.md`.
5. Tell the `verifier` to run `node scripts/mutation-summary.mjs reports/mutation/mutation.json --changed reports/mutation/changed-lines.json` after `npm run test:mutation:diff` and to report its exit status, so the block is seen before a push.
6. Add to `AGENTS.md`: a pull request with a failing `Mutation Of Changed Files` check is not merged (T5).

**Known limits, to be written into `docs/quality-gates.md`.**

- The mutation run excludes the Queen full-fight tests and the data, contract and study property suites, so a line covered only by those counts as not covered. The remedy is a focused unit test.
- The override is Stryker's own comment, `// Stryker disable next-line all: <reason>`, which turns the mutant into an ignored one. It must give a reason. The repository has none today.
- A pull request that changes more than `DIFF_MODULE_LIMIT` (4) mutated modules is skipped by the diff run and is not gated.
- An existing uncovered line that a pull request edits now blocks that pull request. This is intended.

**Acceptance.**

- AC6.1 Tests in `mutation-summary.test.mjs`, seen failing first, cover: `NoCoverage` on a changed line is blocking; `NoCoverage` on an unchanged line is not; `Survived` on a changed line is not blocking and still produces its `::warning`; a summary without changed-line data blocks nothing.
- AC6.2 With fixture files, `node scripts/mutation-summary.mjs <report> --changed <changed-lines>` exits nonzero and prints an `::error` line when a changed line is uncovered, and exits 0 when none is. Without `--changed` it exits 0 for the same report.
- AC6.3 Demonstration on a scratch branch that is never pushed: add an untested branch to one mutated module; the `verifier` runs the diff run and the summary command, which exits nonzero and names that line. Add the test; the same two commands exit 0. Then replace the test with a `// Stryker disable next-line all: <reason>` comment; the summary exits 0. Record the three results in pull request B's description.
- AC6.4 `mutation-diff.yml`'s header comment, `docs/quality-gates.md`, the pull request template, `verifier.md` and `AGENTS.md` all describe the new behaviour, and `docs/quality-gates.md` records the deviation from A17 with its date and the four limits above.
- AC6.5 `npm run verify` passes. `.github/workflows/mutation.yml` is unchanged.

## Done when

- `main` is green and protected, and the latest commit is deployed (AC1.5, AC2.2).
- A subagent's verification run is never refused because a hook rewrote it (AC3.4).
- No threshold in `docs/quality-gates.md` or `app/stryker.config.mjs` is an estimate or awaits a re-run (AC4.1 to AC4.3).
- Every merged pull request that changes `app/` carries a filled-in independent review section (AC5.2, AC5.4).
- An uncovered changed line turns the pull request's mutation job red (AC6.2, AC6.3).

## Not in this plan

Diagnosing the browser failures on pull requests #12 and #13; a golden trace hash for the simulation; `noUncheckedIndexedAccess` (measured on 2026-11-19 at 208 errors in source and 899 in tests); screenshot tests for the Phaser layer; raising the `src/research` mutation score; a pre-push hook. Each needs its own user decision.
