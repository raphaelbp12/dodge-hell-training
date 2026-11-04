# Killer Bee Queen Phase 3 Retune From Tagged Video Evidence - Design

Date: 2026-11-03
Status: approved 2026-11-03; implemented by plan V9 phase 36 (archived)
Owner: user drove the tagging run; agent wrote this design

## Intent

Phase 3 (`phase-3-pond-barrage`) is currently tuned by trainer estimate. A
tagged recording of the real fight now exists, and the user wants the trainer
to reproduce that fight as closely as the evidence supports. The aim is to
match the barrage's **pattern, period and frequency**, not to copy individual
tag timestamps one-to-one, because every tag is quantised to the tagger's
1/30 s frame step and human presses can slip by a frame.

The work is a retune of one phase. It also promotes the deferred cadence
retuning item (D13) for phase 3 only, commits the evidence and corrects one
recorded calibration figure that the evidence contradicts.

## Evidence and the calibration correction

The raw evidence is the user's export, currently at
`C:/Users/rapha/Downloads/killer-bee-queen-observations.json`. Its provenance
block names the source video (`https://www.youtube.com/watch?v=TFclwuPtC94`),
`frameRate` 60, duration 565.7 s, recorded 2026-11-03T21:54:01Z. All 98 tags are
`phaseIndex: 2` (authored phase 3, zero-based). The provenance `frameRate` is
the video's 60 fps; the tagger advances by 1/30 s, and every tag time lands on
an exact 1/30 s grid, so each reading has at most 33 ms of quantisation. The
write-up must state those two rates separately rather than conflating them.

Phase 33 hand-measured the Red Glaive wave at a 7.0 s mean, and V8's
calibration gate used the wiki's "every 7 seconds" as its anchor. The tags fit
the same wave at **6.02 s** with a 0.008 s RMS over three waves, and the user
re-watched and confirmed the video shows about 6 s between waves. The tool's
clock is therefore sound; the earlier 7.0 s figure is superseded. This is
recorded as a correction, not treated as a failed gate retroactively: the
anchor value came from the wiki's prose, and the footage disagrees with it.

## What "match" means here

- Period is estimated by least-squares fit over the tag index within each
  sprite group, not by copying the interval list. Fits suppress click and
  quantisation noise.
- The chosen authored value is the fitted period rounded to a value the
  trainer's fixed-step simulation can hit cleanly, preferring the tag median
  when the intervals are heavily quantised (the blue/red groups are 26
  twelve-frame intervals, 6 thirteen-frame slips and 3 larger slips of 0.333 s,
  0.367 s and 0.467 s, so 0.400 s is the underlying step and 0.4042 s is
  noise).
- Structure is authored, not copied: the blue pair stays two 3-arm spiral
  attacks because their overlap is the visible pattern; the glaive wave stays
  a single ring.
- Unmeasurable geometry stays as authored. Tag data cannot recover rotation
  rates (D20), so only the blue pair's rate is inferred, and only from the
  measured overlap beat.

## Goals

1. Phase 3's seven attacks reproduce the measured periods, arm counts and the
   blue pair's counter-rotation overlap beat.
2. The evidence is committed verbatim and cited from the authored data, the
   mechanics contract and the deferred register.
3. The 7.0 s Red Glaive figure is corrected wherever it is presented as a
   measurement, by a dated correction note beside the original record; archived
   execution records and the T36 waiver text stay intact.
4. The Queen's comparison identity advances, so attempts recorded against the
   old phase 3 are retained in history but excluded from the new best.
5. Tests that encode the old tuning are rewritten to the new values and
   relationships, never deleted to make the change pass.
6. `npm run verify` passes, and a phase-3 drill run reports the new peak
   shards and frame timings without relaxing a bound.

## Non-goals

- Other phases. Measuring them is D22 and stays deferred.
- Projectile speeds, damage, conditions, hitboxes, arena size, telegraphs,
  movement or phase thresholds.
- A reusable observation-to-cadence pipeline in `research/` (approach B below).
- Reproducing the video's frame-by-frame jitter or the exact first-wave
  offset relative to the phase-entry instant.

## Anti-goals

- Hand-editing the exported JSON.
- Inventing a ROTMG fidelity claim that rests only on trainer preference.
- Resolving the white-bomb count silently: the video says 4, the wiki says
  cardinal/intermediate (8), and the disagreement must stay written down.
- Widening a shard or performance bound to accommodate the denser phase.
- Retuning anything else in the same change.

## Constraints

- Authored data is `app/src/game/data/enemies.json`; `data.ts` validates it at
  load. No new pattern kinds or cadence fields are needed.
- Each attack keeps its own clock; all attacks in a phase share the phase
  epoch (phase entry plus telegraph), and `initialDelaySeconds` is added on
  top. Rotation also starts at the epoch (`phases.ts: createAttackClocks`).
- The two blue spirals must remain separate attacks: authoring one 6-arm ring
  cannot produce the 3-ball overlap.
- Live-shard bounds are derived from configuration in tests and in the
  Playwright drill, so they re-derive automatically. No literal is widened.
- V8's T08 ("no authored-data writes") remains true of V8. The retune belongs
  to a new plan version (V9, first phase 36), with its own decision prefix.
- Every new authored value needs a documented source: the observation export
  and its write-up, plus explicit user approval for this retune.

## Approaches

**A - Direct retune (chosen).** Place the export, write the measurement
document with a throwaway script driven by `summarizeTags`, then change the
seven authored attacks, the coupled tests, the mechanics contract and the
deferred register. No new production code beyond one new `tuningSource`
literal and its validator entry.

**B - Build the derivation first.** A pure export-to-cadence function in
`research/`, so the mapping is machine-derived and D22's phases are cheap. V8's
T32 forbids emitting authored cadence, so this needs a plan-rule change plus
code and tests before anything is playable. Rejected for this change: it builds
tooling for one phase and delays the encounter the user wants to play.

**C - Split the risk.** Retune only the rows the video nails and defer the
bee/white interpretation to a second pass. Rejected: the open questions were
resolved by the user (white = 4) or are a documented judgement
(bee = one volley), and a half-tuned phase is harder to judge in playtest than
a fully tuned one.

## Derivation

Least-squares period per sprite group over the tag index, fitted from the
committed export:

| Sprite | Tags | Fit period | Fit RMS | Authored choice |
| --- | ---: | ---: | ---: | ---: |
| blue-ball | 36 | 0.4042 s | 0.025 s | 0.400 s (median; 26/35 intervals are 12 frames) |
| red-ball | 36 | 0.4042 s | 0.025 s | 0.400 s (same timestamps as blue) |
| yellow-ball | 6 | 2.5076 s | 0.073 s | 2.500 s |
| white-bomb | 6 | 3.115 s | 0.247 s | 3.230 s (steady-state intervals; the 2.33 s first gap is pre-barrage) |
| bee-shot | 11 / 5 bursts | 3.043 s between burst starts | - | 3.040 s |
| red-glaive | 3 | 6.017 s | 0.008 s | 6.020 s |

Blue overlap beat: 7 of 36 blue volleys show 3 instead of 6, at 1.6155 s
spacing (RMS 0.025), which is every 4th volley. Two 3-arm spirals with a 60°
initial offset have arms coincident modulo 120 degrees, so the offset advances
by `2ω` per second and the beat period is `120 / (2ω)`. A period of 1.6 s gives
`2ω = 75°/s`, so each spiral turns at **37.5°/s**, and with initial phases 0°
and 60° the first coincidence falls 0.8 s after the first volley (two volleys
later), matching the observed first 3-count at 0.834 s. The model then puts a
coincidence on every fourth volley; it predicts volleys 30 and 34 as 3-counts,
which the tag tail records as 6, and the user's own caveat about missed frames
covers that tail. The pattern is not changed to fit it.

Bee bursts: each visible event is tagged two or three times, one tagger frame
apart (33 ms). Because that spacing is exactly the tagger's step, the reading is
one visible burst stepped across frames, not three distinct volleys; the wiki's
"occasional 4-way burst" agrees. Each event is therefore authored as one 4-arm
volley with no intra-burst volleys.

White bombs: six events of 4, at a steady 3.23 s. The wiki's
"cardinal/intermediate directions" implies 8; the user confirmed the video
shows 4. The video wins, and the conflict is recorded in the phase comment and
the measurement document.

Red and yellow rotation are not recoverable from tags under D20. Red keeps its
authored +40°/s clockwise direction; yellow keeps 0 (a ring, per the wiki).

## Target authored values

All seven attacks keep `shotsPerBurst: 1` and `shotIntervalSeconds: 0.1`, and
get `initialDelaySeconds: 0` so the barrage starts on the phase epoch and every
wave that the video shows together fires together.

| Attack id | Projectile | Arms | Rotation | Initial phase | Cooldown (period) |
| --- | --- | ---: | ---: | ---: | ---: |
| `blue-ball-spiral-cw` | blue-ball-v2 | 3 | +37.5°/s | 0° | 0.40 s |
| `blue-ball-spiral-ccw` | blue-ball-v2 | 3 | -37.5°/s | 60° | 0.40 s |
| `red-ball-spiral-cw` | red-ball | 2 | +40°/s | 0° | 0.400 s |
| `yellow-ball-ring-frequent` | yellow-ball-v1 | 8 | 0 | 0 | 2.500 s |
| `bee-shot-burst-occasional` | bee-shot | 4 | 0 | 0 | 3.040 s |
| `white-bomb-compass-ring` | white-bomb-v1 | 4 | 0 | 0 | 3.230 s |
| `red-glaive-wave` | red-glaive-v1 | 60 | 0 | 0 | 6.020 s |

`emitterRadiusTiles` stays 0 on all seven. Attack ids stay as they are, so the
tests and the drill keep their anchors.

The video's first combined volley contains blue, red, yellow, bee and white at
the same timestamp, so aligning them on the epoch reproduces it. The glaive is
tagged about 0.9 s earlier, but the phase-entry instant cannot be identified
from the tags (the first white-bomb tag is 1.4 s before it), so the 0.9 s lead
is not adopted; the barrage's internal alignment is the pattern the evidence
actually establishes.

## Provenance and `tuningSource`

`tuningSource` is a closed union (`data.ts`: `validTuningSources`). This change
adds a fourth value, **`video-observation`**, meaning "fitted from the tagged
recording, see `docs/killer-bee-queen-observations.md`", and uses it on all
seven phase-3 attacks. This is the point of the field: the value's origin is
stated where it is consumed. The attack comments state which parts remain
trainer choices (red's rotation rate, initial delays, telegraph and movement).
The validator list and the `AuthoredAttack` type change together; no other
authored data uses the new value.

## Sequencing and V8 lifecycle

V8 phase 35 is not complete: 35.1 has no placed export, 35.2 has no write-up,
and 35.3's schema test was skipped because the JSON did not exist. The repo's
lifecycle has only `drafted`, `active` and `archived`, so V8 is finished and
archived, not annotated:

1. **V8 35.1** - place the export verbatim at
   `docs/killer-bee-queen-observations.json` and validate it.
2. **V8 35.2** - write `docs/killer-bee-queen-observations.md` as
   measurement-only evidence. It reports 6.02 s and the 7.0 s cross-check and
   does **not** propose authored values, per V8's T32.
3. **V8 35.3** - add the schema test that reads the committed JSON, then
   archive V8 and record its outcomes.
4. **V9 phase 36** - the retune. V9 carries the target values and the D13
   promotion.

This keeps V8's "no authored-data writes" rule true and keeps the evidence
document from doubling as the tuning decision.

## Rules version

The retune invalidates time-based comparison with pre-retune attempts: phase 3
changes from about 22 to about 34 balls per second and the glaive wave from 8
to 60 arms. Following the phase-24.2 v5→v6 precedent, bump the Queen's
`rulesVersion` in `app/src/game/data/encounter.json` from
`killer-bee-queen-nest-paladin-v7` to `killer-bee-queen-nest-paladin-v8`.
Earlier attempts stay in history and are excluded from the new best by the
existing exact-match rule, with no storage schema change. Update every v7
literal: `config.test.ts` around lines 843 and 856 (including the
pre-retune-record exclusion test, which should use a v7 record against a v8
config) and `app.spec.ts` around line 2398 (the drill `rulesVersion` suffix).
Record the bump and its reason in the mechanics contract.

## Evidence and records to produce

1. `docs/killer-bee-queen-observations.json` - the export placed verbatim.
   Validate with `validateObservationExport`; do not reformat.
2. `docs/killer-bee-queen-observations.md` - the V8 35.2 write-up. Its tables
   are generated by a throwaway script driven by `summarizeTags`, so document
   and tool agree. Sections: provenance and access method, calibration and the
   T12 cross-check (tool 6.02 s, hand 7.0 s, difference 0.98 s, plus the user's
   re-watch confirmation), measured cadences with raw interval lists,
   phase-to-projectile binding, confidence and limits, relationship to authored
   data, and whether the format is worth repeating.
3. Phase-3 comment in `enemies.json` rewritten to the measured pattern and to
   cite the observation files; the white 4-vs-8 conflict and the glaive
   "unavoidable" note are stated there.
4. `docs/mechanics.md`: the retune, the new `video-observation` source, and the
   corrected glaive cadence. The existing V8 research-tooling section already
   names the evidence files; add the retune decision next to it.
5. `docs/deferred-work.md`: amend D13 to record that phase 3 is retuned from
   measured evidence and the remaining phases stay deferred under D22.
6. `docs/plan-v8.md`: append a dated correction that the tagged measurement is
   6.02 s and the user confirmed the footage, leaving the original 7.0 s
   figure, the phase-33 archive and the T36 waiver text intact. Plan-v8.md
   stays in `docs/` after archiving, so the note belongs there rather than in
   an archived phase file.
7. New `docs/plan-v9.md` and its `docs/plan/phase-36.md` for this retune, with
   the design decisions recorded under V9's own decision prefix. V8 is finished
   and archived first; V9 continues the phase numbering at 36.

## Test and verification impact

Known assertions that encode the old tuning and must be rewritten to the new
values/relationships:

- `app/src/game/config/config.test.ts` "reproduces the source's six-attack
  barrage": yellow cooldown `< 2` (now 2.5), bee cooldown `> 4` (now 3.04),
  white bomb `arms` 8 (now 4), glaive cooldown `7` (now 6.02), glaive
  `tuningSource` `wiki-prose` (now `video-observation`).
- The 24.2 tuning-pass guard must keep its history and its premise. Split it:
  the phase-7 `white-bomb-advance` 15° assertion and the "24.2 changed no
  wiki-prose or approved-v3 value" claim for values that pass did not touch
  stay under that title; the glaive assertions move to a new V9 test that
  asserts the measured 6.02 s and `video-observation`. The 24.2 record is not
  quietly rewritten as if it had always measured 6.02 s.
- The blue counter-rotation test still holds (±37.5) and should additionally
  assert the 60° offset and the 0.4 s cadence, so the overlap model is
  protected rather than incidental.
- `data.test.ts`: add the new `video-observation` value to whatever tuning
  source coverage exists; confirm the union change accepts it and rejects an
  unknown source.
- `rulesVersion`: update `config.test.ts` lines around 843 and 856 to
  `...-v8`, and change the older-record exclusion test to use a v7 attempt
  against the v8 config. Update the drill literal in `app.spec.ts` around line
  2398.
- Derived shard bounds: phase 3's worst case rises from 60 to 116 live shards
  (blue pair 15+15, red 10, yellow 8, bee 4, white 4, glaive 60). The
  full-fight peak bound re-derives and must not be weakened.
- Full-fight length (373.43 s) is governed by HP progression, not cadence; it
  should remain unchanged. If it moves, stop and report rather than editing the
  expectation.
- The two `red-glaive` delay assertions (`initialDelaySeconds` 0) remain true.

Verification: focused tests while iterating, then `npm run verify` from `app/`.
The phase-3 drill Playwright case is run once (not the full suite) to report
the new peak shards, collision parts and frame timings, because the phase is
markedly denser and the old 50-52 peak is no longer representative. The
drill's assertions are derived, so a pass is expected; if it fails, that is a
real finding, not a bound to relax.

## Risks and how they are handled

- **Density.** Phase 3 rises from about 22 to about 34 balls per second, with a
  60-glaive wave every 6 s. This is the measured fight and the point of the
  retune; the playtest may show the 19.2-tile arena makes it unfairly dense.
  Any deviation from the measured values is a trainer-authored choice that
  comes back for approval and is recorded, not applied silently.
- **Glaive wave becomes unavoidable.** 60 arms at 0.7 s lifetime and a 9.8
  tile range leave sub-sprite gaps across the arena, which may close the old
  "unavoidable only in the real fight's small room" fidelity gap. Record what
  the playtest shows; do not claim unavoidability without it.
- **One-volley bee reading.** If the video really fires three volleys per
  burst, the authored bee rate is a third of the real one. The write-up records
  the ambiguity; changing it later needs `shotsPerBurst: 3,
  shotIntervalSeconds: 0.033`, an easy follow-up.
- **Small yellow/white samples.** Six events each. Their periods are the
  weakest numbers here; the write-up states sample counts so a later reader
  can re-judge.

## Left to the builder

- How V8's three remaining steps are laid out in its own files, and the exact
  sequence inside V9's single retune phase.
- Playtest mechanics: how to observe phase 3 in the dev build, what to record
  (peak shards, frame timing, whether the glaive wave is dodgable), and which
  findings are reportable facts versus follow-up decisions.
- Any test helper changes needed to assert the new `tuningSource` literal.

## Correction - 2026-11-04

The evidence section says the export's `frameRate: 60` is the video's rate. It is not: it is the tagger's default step setting. Every tag time falls on a 1/30 s grid and phase 33 records the video as 30 fps, so the video presents at about 30 fps. Recorded times come from `mediaTime` and are unaffected, and the JSON is unedited (T33). The observations markdown states the three facts separately: typed step setting 60, presented rate about 30 fps, tag grid 1/30 s.
