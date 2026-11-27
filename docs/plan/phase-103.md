# Phase 103: Doc-Only Pull Requests Skip The Pages Checks

> Step prompts and execution records for phase 103 of [plan v26](../plan-v26.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 103.` for it.

### Step 103.1 - Skip Doc-Only Pull Requests In Pages

Status: pending. Dependencies: none.

**Implementation prompt**

In `.github/workflows/pages.yml`, make the jobs `checks`, `audit`, `build` and `browser` skip on a doc-only pull request (D-26-1, D-26-3). In each, check out with `fetch-depth: 0`, add a detection step modelled on `mutation-diff.yml`'s "Detect app changes" that writes an output `run`. On `pull_request` it lists the files changed from `github.event.pull_request.base.sha` with a three-dot diff and sets `run=false` when every file matches `*.md` or `.claude/*` (an empty diff too), and writes a line to `$GITHUB_STEP_SUMMARY` saying the checks were skipped (D-26-2). On `push` it sets `run=true`. Guard every later step of the job, including the upload and download of the `production-build` artifact, with `steps.<id>.outputs.run == 'true'`. Leave `bench` and `deploy` as they are. Do not add a job-level `if`. Rewrite the header comment, which says a pull request always runs, to describe the new behaviour and keep the T3 reference.

**Focused checks:** parse the YAML locally and confirm each of the four jobs has a detection step and that no other step in it is unguarded; check the detection script against sample file lists: only `docs/plan-v26.md`; `docs/plan-v26.md` plus `app/src/x.ts`; `.claude/skills/a/SKILL.md` only; `app/package.json` only; a JSON file under `docs/`; empty.

**Acceptance:** the sample lists give run, skip and run as D-26-2 requires; check job names and matrix names are unchanged; the YAML parses; `bench`, `deploy` and the other workflows are untouched.

### Step 103.2 - Document The Skip

Status: pending. Dependencies: 103.1.

**Implementation prompt**

Add one sentence to `docs/quality-gates.md`, next to the description of the required checks, saying that a pull request changing only `*.md` or `.claude/**` files runs the Pages checks as no-ops that report success, and why the required checks still report (D-26-4). Change nothing else in that file.

**Focused checks:** none beyond reading the diff.

**Acceptance:** one added sentence, no other change. After the change is merged, a doc-only pull request shows every required check green with its install, test and build steps skipped; record the result as performed or blocked (D-26-5).
