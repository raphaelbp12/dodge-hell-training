# Fixes Review And Implementation Plan

Created: 2026-10-24. Updated: 2026-10-25. Status: Q01-Q20 and R01-R05 decisions recorded; nominal leading-edge calibration derived. Final shared polygons and unspecified presentation tuning remain for implementation review. Runtime implementation has not started.

Reviewed repository baseline: `9e82e57`, with rules version `crystal-worm-child-head-paladin-v1`. Sources: [your fixes](../fixes.md), your local-only screenshot (`image.png` at repository root), [approved mechanics](mechanics.md), [completed implementation archive](implementation-plan-v1.md), and [original draft](../first-draft.md). Existing implementation-plan statuses and the approved baseline are unchanged.

This review checks the requests against the actual code and the supplied image. It does not independently establish current ROTMG client behavior. Sections 1-3 retain the initial assessment, not the final revised contract. The batch decisions in section 4 supersede conflicting recommendations, especially center-to-wall contact and unchanged circular hitboxes. No interactive question prompts are needed; unresolved numeric choices remain in this file.

## 1. Reference Crops For Identification

These three PNGs were created for this review, not installed as game assets. They preserve the original pixels at native scale: no resizing, background removal, reconstruction, or sharpening. Coordinates are `(x, y, width, height)`, measured from the top-left of the original 857x700 image.

| Candidate | Original rectangle   | Unscaled crop                           | Confirmed identity / measurement caveat                                                                                     |
| --------- | -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Player    | `(224, 394, 46, 48)` | Local-only `fixes-player-candidate.png` | Confirmed by Q01: the left-hand character above the green health bar. Exclude its weapon when measuring the body.           |
| Head      | `(405, 302, 44, 55)` | Local-only `fixes-head-candidate.png`   | Confirmed by Q01: the central purple/cyan object. An overlapping effect still prevents exact contour recovery.              |
| Shard     | `(480, 23, 45, 65)`  | Local-only `fixes-shard-candidate.png`  | Confirmed reference identity; "same size" was an approximation. Measure the full colored body, not only its pale highlight. |

The rectangle sizes are review-window dimensions, not measured sprite dimensions or hitboxes. The player and shard appear broadly comparable in visual scale, with the shard notably elongated; exact equality depends on which dimension is compared and on orientation. The head's overlap prevents a reliable clean size measurement. Identity confirmation comes before final size ratios.

The image can support a relative visual comparison within the same frame. It cannot establish absolute tile dimensions without a scale reference, nor collision shapes from artwork. Rotated elongated sprites have different screen-aligned bounding boxes; compare a canonical width/height or defined longest dimension, not arbitrary rotated rectangles.

The source screenshot and these crops are reference material only. Their availability does not establish permission to publish ROTMG artwork as app assets. Per the user's publication decision, the root `.gitignore` excludes the source screenshot, these crops and the calibration image; they remain local and are not committed or bundled. Crop and calibration filenames in this document are relative to `docs/`. A fresh clone will not contain them; the measurements and decisions remain recorded here. Original or appropriately licensed art remains an alternative.

## 2. Claim-By-Claim Assessment

| Request                                     | Current behavior                                                                                                                                                                      | Assessment and consequence                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eleven shards instead of four per burst     | Four emitters; four sequential shots per emitter; sixteen shards per group.                                                                                                           | A coherent tuning request, but eleven is not proved by this screenshot. Eleven per emitter would mean forty-four shards per group, not eleven total. Confirm the counting convention.                                                                                              |
| One second between bursts                   | Two seconds from the last shot to the next group's first shot; individual shots are 0.15 seconds apart.                                                                               | Ambiguous between cooldown-after-last-shot and start-to-start period. These produce materially different patterns. See the arithmetic below.                                                                                                                                       |
| Projectiles approximately character-sized   | Rendering currently uses collision radii: player 0.25 tile, shard 0.15 tile. At zoom 1, filled-circle diameters are 16 and 9.6 CSS pixels respectively, before outlines/antialiasing. | The screenshot supports revisiting visual size and replacing the tiny circular representation with a larger elongated shape. It does not establish a projectile collision radius equal to the character's. Separate visual dimensions from hitboxes before tuning.                 |
| Shots originate at the enemy center         | Four origins lie on a 0.75-tile ring around the enemy.                                                                                                                                | A clear requested trainer change. Keep four direction phases, but use one shared position. The current validator rejects radius zero, so this needs a validation change as well as a constant edit. Align the enemy's art anchor with the intended origin.                         |
| Screenshot shows maximum distance           | Approved provisional speed is 8 tiles/second, reversal at 1.2 seconds, expiry at 2.4 seconds.                                                                                         | One frame shows current positions, not necessarily reversal positions or the maximum excursion. The head moves, and a shard's emission position may differ from the head's current position. A tracked clip or authoritative timing data is needed to independently measure reach. |
| Persist camera zoom in localStorage         | Zoom survives R and Home/Start only during the current app visit.                                                                                                                     | A straightforward preference feature. Keep it separate from attempt history, validate saved values, and write only when zoom changes. Storage failure must not prevent play.                                                                                                       |
| Health bar below the character              | Health exists in the React HUD only.                                                                                                                                                  | A presentation enhancement. Draw the following bar in Phaser from the same health state; retain the HUD unless explicitly replaced. Do not create per-frame React positioning.                                                                                                     |
| Damage tooltip and hit sound                | Hits update health/hit totals, but no individual damage-feedback stream is exposed.                                                                                                   | A presentation enhancement requiring a precise definition of "tooltip" and feedback policy. Health deltas cannot reliably reconstruct damage because regeneration, multiple hits, and lethal clamping can occur in the same update. Use actual accepted-hit data.                  |
| Controls modal                              | Controls are documented in the README; no in-app modal exists.                                                                                                                        | Useful discoverability work, with input/focus implications. Existing R/Escape handlers can operate while focus is elsewhere inside the app, so a dialog must explicitly block background gameplay controls.                                                                        |
| Arena as large as double enemy reach        | Static arena radius 16 tiles, diameter 32; enemy begins 13 tiles north of center.                                                                                                     | The explanatory sentence implies diameter equals twice the outward reach, meaning radius equals reach. This is not a time-shrinking arena. The smaller proposed radius invalidates the old enemy spawn and increases encounter pressure.                                           |
| Resize parameters after comparing the crops | Typed gameplay values exist, but rendered body sizes are coupled to collider radii.                                                                                                   | Named visual dimensions and a fixed comparison view will make iteration safer. This does not require an in-app tuning UI, which remains outside the approved scope.                                                                                                                |

The implementation anchors for these findings are [typed configuration and validation](../app/src/game/config/encounter.ts), [burst scheduling, projectile motion and hit registration](../app/src/game/simulation/simulation.ts), [drawing and the sole runtime clock](../app/src/game/phaser/encounter.ts), [React screens and zoom preference](../app/src/App.tsx), and [the existing defensive storage adapter](../app/src/storage/attempts.ts).

### Burst Arithmetic And Workload

If four emitters and 0.15-second individual-shot spacing are retained:

- Current group: four shots per emitter, sixteen shards total. First-to-last-shot span is `(4 - 1) * 0.15 = 0.45` seconds; start-to-start period is `0.45 + 2 = 2.45` seconds.
- Proposed eleven-shot group: forty-four shards total. First-to-last-shot span is `(11 - 1) * 0.15 = 1.5` seconds.
- If the requested one second is a cooldown after the last shot, start-to-start period becomes `1.5 + 1 = 2.5` seconds. Average emission rises from about 6.53 to 17.6 shards/second, approximately 2.70 times the current rate.
- If it means a one-second start-to-start period, groups overlap with the current spacing. Avoiding overlap would require spacing at most 0.1 seconds, with exactly 0.1 leaving no idle gap between the last shot and next first shot. This is a different scheduling decision, not a simple cooldown replacement.
- With the proposed 2.5-second period and unchanged 2.4-second lifetime, forty-four live shards is a conservative bound: each emission slot repeats less frequently than its shard lifetime expires. The current sixteen-shard performance assertions must be revised from approved timing, not simply removed. Other cadence/lifetime choices need a newly calculated bound.

Recommendation: interpret one second as cooldown after the last shot, retain current intra-shot spacing/rotation/initial cooldown unless changed explicitly, and verify the resulting longer stream visually. This is a proposed interpretation, not a source-verified ROTMG cadence.

### Range, Arena And Spawn Arithmetic

Under the currently approved symmetric out-and-back motion, outward center travel is speed times reversal age, not speed times lifetime:

$$
d_{out} = v t_{reverse} = 8 \times 1.2 = 9.6\text{ tiles}
$$

For a stationary enemy at arena center, emission offset $e$, and projectile centers reaching the boundary:

$$
R = e + d_{out}, \qquad D = 2R
$$

With the requested centered emission, $e = 0$: radius would be 9.6 tiles and diameter 19.2 tiles. If instead the projectile's leading visual edge should just touch the wall at reversal, add its forward visual half-extent to the radius. A collision-edge criterion would use the collider's extent, not automatically the artwork's. Choose one definition rather than mixing them.

Important consequences:

- The existing 19.2-tile wiki range is still recorded with unresolved range semantics. If it were confirmed as outward center reach instead, a symmetric 8-tiles/second shot would reverse at 2.4 seconds and expire at 4.8 seconds, and the center-reach arena radius would be 19.2. The screenshot alone does not justify that switch.
- Changing radius from 16 to 9.6 reduces diameter to 60% and area to 36% of the old arena, before accounting for larger colliders. Together with the higher firing rate, this is a substantial difficulty change.
- The old enemy spawn is invalid: `13 + 0.6 > 9.6`. A replacement needs approval. Keeping the existing three-tile center-to-wall margin suggests north spawn `(0, -6.6)`; keeping its old radial fraction `13 / 16` suggests `(0, -7.8)`. Neither is approved, and both shorten the initial player-enemy separation. Recheck after any collider change.
- "If the enemy is in the center" is a calibration condition, not necessarily a request to spawn it there. Do not silently move the enemy onto the center-spawned player.
- In actual play the head pursues and emits from different positions. This radius relationship does not guarantee all projectiles stay inside the arena. Lifetime-only expiry remains: no wall/offscreen despawn or trajectory clipping is implied.
- Existing shards must still reverse their velocity once and ignore subsequent head movement. Centralized emission does not mean homing back to the moving head or storing a firing origin.

## 3. Implementation Boundaries And Safeguards

**Visuals:** use named dimensions with explicit units, separate from collision radii. Agree sprite identity, aspect ratio, rotation behavior, and anchor before assigning final dimensions. Keep the head's visual center and firing origin consistent; player art may use a feet/ground anchor without deriving its collider from full sprite height. Use original geometric/pixel-style approximations unless reusable artwork is approved. The review crops are not runtime textures.

**Zoom preference:** extend the storage boundary with a small dedicated adapter/key, not the history envelope or a generic settings framework. Read safely at app initialization; accept finite values within approved bounds/step policy; otherwise use the default. Catch blocked reads, corrupt data and write/quota errors. Keep a visit-local preference when persistence fails. Persist only actual changes, not every HUD publication or frame. Never put localStorage access in models or simulation. No backend, accounts or cross-origin synchronization is needed.

**Health bar:** Phaser draws it below the character from the authoritative HP/max HP, with named placement/size/color values. Keep clear of the body and avoid obscuring incoming shards. Test full/partial/zero health, zoom/resize, retry/Home cleanup and results transition. It must not affect hitboxes or timing.

**Damage feedback:** expose lightweight typed data for actual accepted hits through the existing simulation/session advancement boundary; include enough information to distinguish individual hits and damage from regeneration. Consume it in the Phaser/runtime layer without an event-bus framework, persistent event history, or per-projectile React updates. Emit once per eligible shard hit, including lethal hits, never on the spent shard's return or after death. Use the approved damage calculation, not an invented duplicate formula. Displayed numbers and sound grouping are decisions below.

**Audio:** unlock audio from a user gesture such as Start/Retry; tolerate suspended/blocked/unsupported audio without breaking play. Use an original synthesized cue or explicitly reusable asset. Keep volume/polyphony bounded with approved presentation constants; no queued catch-up of stale sounds. Dispose owned audio/effects on cleanup and clear stale feedback on retry/Home. Audio failure/muting must never change damage or simulated time.

**Controls modal:** React owns an accessible labeled dialog, close action, focus containment/restoration and any help button. Phaser/session remain responsible for paused input and time. Opening during play/countdown must freeze the relevant state; W/A/S/D, R and O/P cannot act behind it. Escape should close the dialog once without also toggling background pause. Closing must respect prior pause/focus-loss state, not accidentally resume hidden play. List WASD, R, O/P, Escape and the actual UI actions; distinguish standard Tab/Enter/Space button interaction from custom bindings. No key rebinding or new shortcut is assumed.

**Comparisons:** shot count/cadence, emission position, arena/spawns, range or collider changes require a new rules identity. A proposed next identity is `crystal-worm-child-head-paladin-v2`, subject to approval. Keep old records labeled as other rules, not deleted or relabeled. The storage schema need not change if record fields do not. Use a coordinated gameplay change set, or a separate rules version for each published comparison-breaking intermediate preset; do not ship multiple different physics presets under one version. Pure viewing preferences do not automatically split comparisons under the existing policy.

**Preserved scope:** one head, fixed Paladin stats, four rotating directions unless changed explicitly, no player attacks/abilities, no body-contact damage, no global invulnerability, no collision despawn, no shrinking-over-time arena, no touch controls, no tuning UI. Keep the existing one-clock architecture and bounded React HUD updates.

## 4. One-Batch Decision Table

The user answered all twenty entries and emphasized image-based proportions and simple visual-matching collision geometry as the next priority. These decisions are design approval, not independent verification of the retail client.

| ID  | Recorded decision                                                                                                                                  | Remaining precision                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01 | All three crop identities are correct.                                                                                                             | The head's visible contour is still partly occluded.                                                                                              |
| Q02 | "Same size" was an approximation; calculate proportions from the image.                                                                            | Measure the body silhouettes, not the crop windows.                                                                                               |
| Q03 | Use our own simple art or code-generated shapes, not the same sprites.                                                                             | Public distribution permission for the reference screenshot/crops was not answered; keep them reference-only.                                     |
| Q04 | Four emitters, eleven shots per emitter: forty-four per group.                                                                                     | Settled.                                                                                                                                          |
| Q05 | Wait one second after the eleventh shot before the next group.                                                                                     | Settled: no overlapping groups at unchanged spacing.                                                                                              |
| Q06 | Keep 0.15-second shot spacing, clockwise 45 degrees/second rotation and two-second initial firing cooldown.                                        | Settled: group period 2.5 seconds.                                                                                                                |
| Q07 | Near-center emission is acceptable; it need not be exactly zero.                                                                                   | Select a small offset relative to the calibrated head, not an arbitrary large ring.                                                               |
| Q08 | Treat the lower-left outer yellow projectile as maximum reach for this calibration; derive proportions and compare with the wiki's 19.2 reference. | Separate the range interpretation from speed and distinguish projectile center from leading edge.                                                 |
| Q09 | The projectile should only touch the arena edge at maximum reach.                                                                                  | Use its visible/collision leading edge, not the old center-to-edge recommendation.                                                                |
| Q10 | Keep player-center/enemy-near-edge spawn policy.                                                                                                   | Recompute the numeric enemy position only after the radius and head extent are calibrated; "yes" does not select every alternative spawn formula. |
| Q11 | Collision must match the visible body as closely as practical, using simple shapes with at most eight sides.                                       | Replace the old small-circle proposal with shared visible/collision polygon geometry.                                                             |
| Q12 | Persist zoom and allow a wider in/out range.                                                                                                       | Actual new limits and step policy were not specified; retain finite practical limits rather than unbounded zero/infinite zoom.                    |
| Q13 | Always-visible below-character health bar.                                                                                                         | No request to remove the existing HUD.                                                                                                            |
| Q14 | Floating post-defense amount for each accepted hit.                                                                                                | Retain current damage calculation; display is not inferred from health deltas.                                                                    |
| Q15 | Accept recommended separate hit numbers/cues, bounded mixing and visible lethal feedback without delaying results.                                 | Numerical effect durations/voice limits remain presentation tuning.                                                                               |
| Q16 | Accept recommended original synthesized cue and user-controlled mute.                                                                              | Default volume and persistence of mute were not numerically specified.                                                                            |
| Q17 | Controls access on Home and gameplay HUD.                                                                                                          | No new custom shortcut requested.                                                                                                                 |
| Q18 | Accept explicit Resume after closing; also show a centered "Paused" label like the countdown.                                                      | Escape must close a dialog without also toggling gameplay; no inactive-time catch-up.                                                             |
| Q19 | Accept proposed v2 rules identity and retain incompatible v1 history.                                                                              | Publish the revised gameplay as one coordinated comparison-breaking preset.                                                                       |
| Q20 | Accept provisional trainer tuning, without claims of exact client fidelity.                                                                        | Image-based scale assumptions and uncertainty must be documented.                                                                                 |

The wiki value is 19.2 **tiles of range**, not 19.2 tiles/second. The recorded wiki speed is 8 tiles/second. The latest wording "speed of 19.2" is treated as a unit mix-up, not approval to increase projectile speed.

## 5. Staged Implementation Plan

The executable follow-up is now [phases 8-14 of the main implementation plan](../implementation-plan.md#phase-8-revised-contract-and-geometry-approval), beginning with `/implement-step 8.1`. That plan owns numbered step dependencies, prompts, acceptance checks and completion records. The F0-F7 outline below is retained as design history, not a second status tracker; no runtime step has started.

Each future implementation slice starts with a focused failing behavior test, then the smallest change, then the same focused check. Reuse [the existing browser tests](../app/tests/app.spec.ts) and neighboring config/simulation/session/storage/React tests. Do not create a second game clock or duplicate test framework. No stage below is being implemented automatically.

### F0 - Confirm Reference Objects And Visual Targets

Status: identities and original-art approach approved; nominal dimensions recorded in section 7.8 under the selected leading-edge convention; final shared polygon review pending. Dependencies: Q01-Q03 and recorded R01 below.

Review the supplied crops, obtain a cleaner head frame if needed, and agree a canonical player/head/shard comparison, aspect ratios, anchors and artwork approach. Use an explicit common scale without stretching individual assets to make a desired result appear true. Record dimensions as approved presentation values, not inferred hitboxes. An isolated comparison screenshot is a test/review aid, not an in-app tuning screen.

Acceptance: the intended objects and meaning of "same size" are unambiguous; art/publication permissions and remaining visual uncertainty are recorded.

### F1 - Approve The Revised Mechanics Contract

Status: pending. Dependencies: F0 and decisions Q04-Q11, Q19-Q20; record independent UI decisions Q12-Q18 as well.

Append approved changes and provenance to the mechanics contract; preserve the historical v1 specification/acceptance record. Define burst semantics, initial cooldown, outward reach, boundary criterion, replacement spawn and colliders with units. Choose the coordinated new rules identity and retain the original invariants. Recalculate burst duration, emission rate, live-shard bound and spawn validity from approved inputs. Do not update old plan steps to pretend these changes were part of their original approval.

Acceptance: no unresolved numerical/semantic choice feeds the gameplay change set; documentation/arithmetic checks pass. If evidence is insufficient, record a provisional user choice or a blocker, never an invented fidelity value.

### F2 - Define And Review Shared Body Geometry

Status: pending. Dependencies: F0/F1, Q11 and Q13.

Use the measured proportions and approved world scale to define original convex body silhouettes with at most eight vertices each. The same typed local vertices, dimensions, position and orientation must define both drawing and collision; separate parameter ownership must not create independent hidden hitboxes. Build the side-by-side calibration review first. Geometry and the new collision behavior reach the playable preset together in F3 under v2, not as an unversioned artwork-only change. Keep the current HUD and existing clock.

Focused checks: common-scale comparison; convexity, nondegenerate area and three-to-eight vertices; shared render/collision transforms; player/head/shard proportions at min/default/max zoom. Pixel tests currently assume circular/palette characteristics and need intentional, reviewed updates rather than weakened checks. Exclude only explicitly decorative shadows, health bars and feedback from the visible physical body.

Acceptance: the original silhouettes and their exact matching collision outlines are approved as one geometry definition; no small invisible circle remains the final hit test.

### F3 - Apply The Coordinated Encounter Changes

Status: pending. Dependencies: F1 and approved geometry from F2.

Implement approved shot count/cooldowns, near-center origin, calibrated range, static arena size, spawn and shared polygon collision as one comparison-versioned gameplay change set. Allow a nonnegative emitter offset while retaining positive, valid polygon dimensions; test zero is accepted and negative/nonfinite offsets rejected. Implement continuous polygon sweeps through the existing movement/reversal/expiry segments, not endpoint-only overlap tests. Preserve the four phases and clockwise rotation. Newborn shards use the enemy's current position; old shards ignore later pursuit. Derive circular-arena contact from actual vertices, and review pursuit stopping distance against the larger bodies without adding body-contact damage or physical blocking.

Focused checks: exact eleven-shot timing/forty-four total if approved, first/between-group cooldown boundaries, center origins on a moving enemy, unchanged reversal/lifetime/once-only hits, swept collision cases if sizes change, valid spawn extents, arena tangential movement, schedule equivalence and the newly derived live-shard bound. Update hardcoded v1 expectations in tests deliberately; preserve separate old-history compatibility cases. Never "fix" results by removing meaningful lifetime/resource assertions.

Acceptance: approved pattern and arena geometry pass pure and browser checks, with one correct new rules identity and no old-score contamination.

### F4 - Persist Zoom Safely

Status: pending. Dependencies: approved Q12; independent of new physics once its contract is settled.

Add a minimal storage preference boundary and initialize the app/adapter from it. Deduplicate writes to actual zoom changes; retain in-memory fallback and existing R/Home behavior. Do not couple this key to attempt-history corruption or deletion. No speculative settings framework or cross-tab merge.

Focused checks: valid/absent/malformed/nonfinite/out-of-range values, blocked storage getter/read/write, quota failure, no repeated unchanged writes, and actual O/P -> reload -> restored camera scale. Confirm history is untouched and practice remains playable when persistence fails.

Acceptance: zoom survives a normal reload/new visit at the same origin and degrades safely without affecting time or score compatibility.

### F5 - Add Health Bar And Per-Hit Feedback

Status: pending. Dependencies: Q13-Q16 and the approved geometry/simulation/session behavior.

Draw the always-visible below-character health bar in Phaser from authoritative HP/max HP, retaining the HUD. Return/forward narrowly typed accepted-hit data through the pure rules/session boundary, then create visual/audio effects in the adapter. Do not infer hits from the 10-Hz HUD, raw health differences or projectile overlap alone. Implement the approved number/grouping/volume/mute policy with named units. Handle autoplay and audio failures without affecting play; no unapproved sound assets or global event bus.

Focused checks: health bar at full/partial/zero HP, zoom/resize/retry; normal/independent same-tick/lethal hits, regeneration in the same update, spent-return suppression, one cue per approved event policy, mute/unavailable audio, user-gesture unlock, no stale effects after retry/Home, and lifecycle cleanup with one runtime. Verify feedback is presentation-only.

Acceptance: real accepted hits produce the agreed feedback once, damage/math are unchanged, and audio failure is nonfatal.

### F6 - Add The Controls Modal

Status: pending. Dependencies: Q17-Q18 and any audio control approved in F5.

Add the agreed Home/HUD access points and a native accessible dialog where suitable. Describe the actual keys/actions, not speculative future features. Gate gameplay input while open, pause active/countdown time, isolate Escape handling, and restore focus/pause state correctly. No rebinding or touch controls.

Focused checks: accessible name, keyboard open/close/Tab/focus return, desktop/narrow layout, no W/A/S/D/R/O/P action behind the dialog, closing Escape fires once, explicit Resume policy, focus-loss safety, and no hidden-time catch-up.

Acceptance: every current binding is discoverable, dialog focus works, and opening/closing cannot move, reset or unintentionally resume the encounter.

### F7 - Revalidate Repeated Practice And Publish Only When Authorized

Status: pending. Dependencies: approved implementation slices above.

Run all five required gates from `app/`: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. Recheck the sustained-play/retry test using approved new counts/bounds; old v1 stationary death times and peak counts are historical observations, not targets for the revised encounter. Review desktop/narrow screenshots, max/min restored zoom, simultaneous-hit sound behavior and controls accessibility. Retain known browser/fidelity limits rather than claiming universal certification.

Complete a repeated-practice review: Start, observe cooldown/eleven-shot streams if approved, dodge, take damage, die, Retry/R repeatedly, open/close Controls, return Home, reload, and verify zoom plus correct new-version history/best. Storage/audio failure must leave practice usable. Update README/changelog with only implemented features.

Acceptance: agreed visual/feel review and technical gates succeed. Commit/push require a separate authorization; after an authorized deployment, rerun the production-safe checks at its actual emitted Pages URL and record run/commit evidence. This planning task does not commit, push, deploy or claim a fresh live check.

## 6. Work Done In This Planning Task

- Read the notes, reviewed the supplied image and relevant code/contract, and created this plan with one centralized question batch. No source notes, gameplay code, existing mechanics approvals, lockfile or original plan status was changed.
- Created and visually inspected the three candidate crops above. Saved PNG dimensions and every pixel were compared with their source rectangles; the source image remained unchanged. Original SHA-256: `f1c9b0715e8d2b91f1eac60ea3ad9e5adc694e4e2bcbd3fc65f9426b5f9cc86b`.
- The only implementation-adjacent outputs are these local reference images, not runtime artwork. Crop rectangles identify the candidates but do not certify full isolated sprite dimensions. A cleaner head image and any cadence/reach evidence can be supplied with the batch answers.
- No fresh app test suite, audio implementation, live/client verification, commit or push is claimed. Documentation, arithmetic, image-integrity and worktree checks are the appropriate validation for this planning-only change.

## 7. Image Calibration And Collider Design

This section records the follow-up after the user's batch answers. It supersedes the initial recommendations to retain tiny circles or measure arena contact using only the projectile center. The user explicitly identifies the lower-left outer yellow projectile as maximum reach; that is the adopted **calibration assumption**, not a claim that a still frame independently proves trajectory timing or a stationary firing origin.

### 7.1 Measured Landmarks And Method

Local-only annotated reference: `docs/fixes-calibration-reference.png` (not committed).

The annotation preserves the original 857x700 scale. Cyan boxes show measured colored-body bounds, not final colliders. The line joins colored-pixel centroids of the visible head and selected outer shard. It deliberately selects the projectile near `(112, 591)`, not the nearer one near `(125, 496)`.

Measurement procedure: restrict each feature to its stated region, filter its colored foreground, compute bounds/centroid, then use covariance principal axes for the rotated shard's length/width. Include pixel-square support when measuring along rotated axes. Compare a broad body mask with a stricter highlight mask to reveal threshold sensitivity. The principal-axis rectangle is a dimension estimate, not a claim that the glyph is rectangular or exactly symmetric.

| Feature                           | Region `(x,y,width,height)` | Broad-mask result, source pixels                                                          | Sensitivity / limitation                                                                                                                                          |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player body, excluding weapon/bar | `(226,398,38,42)`           | Bounds `(228,400,36,33)`                                                                  | Highlight-only bounds are 35x32. The right side abuts the weapon-exclusion region; allow a few pixels of contour uncertainty rather than claiming an exact width. |
| Visible head                      | `(405,302,44,55)`           | Bounds `(407,302,42,55)`; centroid `(427.818,328.714)`                                    | Highlight selection gives 42x48 and centroid `(425.786,335.622)`; occlusion and crop-edge contact make head size/anchor the least reliable measurement.           |
| Upper isolated shard              | `(480,23,45,65)`            | Bounds 34x54; principal dimensions 55.975x35.146                                          | Highlight-only principal dimensions 53.444x21.500. Pale yellow is not the whole orange/yellow body.                                                               |
| Lower-left outer shard            | `(85,560,65,65)`            | Bounds `(94,569,41,41)`; principal dimensions 56.576x34.660; centroid `(112.402,590.612)` | Highlight-only dimensions 54.271x23.613. The broad upper/lower measurements agree closely despite different orientation.                                          |

For reproducibility, broad yellow selection used `R >= 175, G >= 110, B <= 155, G > 1.15*B`; strict selection used `R >= 220, G >= 170, B <= 150, G > 1.2*B`. Broad player selection used `R >= 75, G >= 40, B <= 215` and at least one of `R > 1.3*B`, `G > 1.15*B`, or all channels greater than 115; strict used `R >= 145, G >= 95, B <= 210`. Broad head selection used either `G >= 125, B >= 115, R <= 220` or `R >= 90, B >= 110, R > G+15`; strict used the corresponding thresholds 165/145/215 and 125/145/15. These masks are measurement aids, not alpha masks to reuse as assets.

With the broad colored centroids:

$$
D_{px} = \sqrt{(427.818-112.402)^2+(328.714-590.612)^2} \approx 409.973\text{ px}
$$

The farthest selected outer-shard pixel center is `(95,609)`, approximately **435.118 px** from that head anchor. Its square pixel footprint adds at most about 0.7072 px; unknown outline/anchor/occlusion errors are more important than that subpixel precision. Replacing both broad centroids with highlight centroids changes the center distance to about 403 px. Use approximately **410 px**, not an allegedly exact physical reach. Historical head movement between firing and reversal remains an additional assumption not measurable here.

### 7.2 Ratios We Can Establish Now

Normalize by the working player-body height of 33 source pixels, not by the review crop height:

| Dimension                              | Relative to player height                         |
| -------------------------------------- | ------------------------------------------------- |
| Player body width / height             | 1.09 / 1.00                                       |
| Visible head width / height            | Approximately 1.27 / 1.67; head contour uncertain |
| Shard long / short dimension           | Approximately 1.71 / 1.05                         |
| Head-to-shard-center maximum reference | Approximately 12.42 player heights                |
| Head-to-shard-leading-pixel reference  | Approximately 13.19 player heights                |

This supports a shard roughly character-wide but appreciably longer than the character body, not a forced 1:1 circle. Preserve these approximate proportions in original simple geometry. Head occlusion means the head ratio is a working target for review, not a recovered exact sprite or client hitbox.

### 7.3 Historical Alternatives: Not The Selected Convention

The wiki numbers have different dimensions: **range 19.2 tiles; speed 8 tiles/second**. Before R01 was answered, both following alternatives fit the measured ratios. They are retained for comparison, not as the final preset: the user subsequently chose maximum head-center-to-leading-edge distance, calculated in section 7.8. Do not call 19.2 a speed or silently relabel total path as outward travel.

For zero emission offset and the measured centroid separation as outward center travel:

$$
S_{ref} = \frac{D_{px}}{d_{out}},\qquad t_{reverse}=\frac{d_{out}}{8},\qquad T=2t_{reverse}
$$

`S_ref` is source-image pixels per world tile. It is not a requirement to replace the application's 32 CSS pixels per tile: camera zoom can change display scale without changing any world distance, speed or collision. Do not define a world tile to equal one character height just to force a preferred answer.

| Derived value                                      | A: 19.2 is total out-and-back path | B: 19.2 is outward center travel |
| -------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Outward travel                                     | 9.6 tiles                          | 19.2 tiles                       |
| Source pixels per tile                             | 42.7055                            | 21.3528                          |
| Player width x height                              | 0.8430 x 0.7727 tiles              | 1.6860 x 1.5455 tiles            |
| Visible head width x height                        | 0.9835 x 1.2879 tiles              | 1.9670 x 2.5758 tiles            |
| Shard length x width                               | 1.3248 x 0.8116 tiles              | 2.6496 x 1.6232 tiles            |
| Reversal / symmetric lifetime                      | 1.2 / 2.4 seconds                  | 2.4 / 4.8 seconds                |
| Approximate arena radius from observed outer pixel | 10.1888 tiles                      | 20.3776 tiles                    |
| Conservative live-shard bound at approved cadence  | 44                                 | 88                               |

The radius row includes the **leading body edge**, unlike the old 9.6/19.2 center-reach radii. It is illustrative and must be recalculated for the final original polygon and emission offset. Model A preserves the old range interpretation while changing geometry; model B is a plausible proposed v2 reinterpretation if the selected furthest projectile is intended to represent the wiki's outward range. Neither interpretation is independently resolved by the frame. The table assumes straight symmetric return and unchanged speed; it does not claim timing was measured from the image.

Changing the apparent tile size alone cannot choose between A and B: both reproduce the same size/reach ratios. On 2026-10-25 the user selected a third definition: the maximum distance from the head to the projectile's leading edge. That explicit trainer decision resolves the design ambiguity; it does not independently establish retail range semantics. Neither A nor B's center-travel timing is the chosen final value.

### 7.4 Near-Center Emission And Edge-Only Arena Contact

Use a small emission offset tied to head size, not to an unrelated screen-pixel constant. Approved by R02 on 2026-10-25: **10% of head width** (about 4.2 source pixels), instead of the old large ring. The positive offset is included in section 7.8; zero remains a valid configuration input, not the selected offset.

If the selected wiki range means travel **from the emission point**, then:

$$
S_{ref}=\frac{D_{px}-e_{px}}{d_{out}},\qquad e_{tiles}=\frac{e_{px}}{S_{ref}}
$$

If instead 19.2 is defined as the **head-center-to-projectile-center** maximum, use `S_ref = D_px / 19.2` and `d_out = 19.2 - e_tiles`; reversal is then `(19.2 - e_tiles) / 8`, not automatically 2.4 seconds. If the intended 19.2 ends at the leading body edge, that extent must also be subtracted before computing center travel. These definitions must not be mixed.

For the final shared local polygon with transformed vertices `q_i`, direction `n` and stationary head at arena center, exact edge-only circular contact is:

$$
R = \max_i \left\| (e+d_{out})n + q_i \right\|
$$

This checks the farthest actual vertex, not a bounding circle or an assumed half-height. Simply adding a half-length is exact only when the relevant farthest point lies on that radial axis. An elongated polygon's off-axis corners can otherwise touch earlier. The calibration places the head at center only for the measurement; pursuit and lifetime-only off-arena shards remain unchanged in real play.

Recompute the enemy spawn and stopping behavior after choosing geometry. For example, preserving a three-tile center-to-wall spawn margin gives north positions about -7.1888 (A) or -17.3776 (B), before final polygon/offset adjustment; neither is an approved final spawn. With B's larger bodies, the old one-tile center stopping distance permits obvious body overlap: axis-aligned half-extents sum to about 1.83 tiles horizontally or 2.06 vertically. Prefer a direction-dependent stopping separation derived from the shared silhouettes plus an approved small gap, without adding physical body blocking or contact damage.

### 7.5 Recommended Collider: Shared Convex Polygons And Continuous SAT

**Representation:** three-to-eight ordered vertices per physical body, convex and nondegenerate. Start with original beveled quadrilateral/octagon silhouettes at the measured proportions; keep any facial details inside that silhouette. Do not copy the original pixel zigzag or trace every notch. The same canonical polygon data and world transform supply both the Phaser fill and simulation geometry. Visible borders must not create a materially larger physical-looking body outside the collider. Shadows, health bars, floating numbers and particles are explicitly nonphysical decorations.

**Orientation:** player/head bodies can remain upright. A shard's elongated axis follows its original firing direction; use a centrally symmetric silhouette so reversing velocity does not unexpectedly change its occupied shape. Do not add within-tick spinning. If future artwork requires actual time-varying rotation, translational swept SAT alone is insufficient and that needs a separate reviewed design.

**Broad phase:** bounding circles or AABBs may quickly reject distant pairs, but overlap there never causes damage. This prevents the invisible-corner hits that a large circle around an elongated projectile would introduce.

**Narrow phase:** use continuous separating-axis testing (swept SAT) for two translating convex polygons with fixed orientations during each existing motion segment. Reuse the existing geometry dependency for suitable primitives, and keep the collision query as a small pure geometry adapter rather than adding another physics world/clock. Do not replace this with Phaser overlap/despawn behavior or endpoint-only SAT; the latter can tunnel through the player.

For every edge normal from both polygons, project their vertices to intervals `A=[a_min,a_max]`, `B=[b_min,b_max]`. Let `s` be relative segment displacement projected onto that normal. For nonzero `s`, the overlap-time interval endpoints are:

$$
u_1=\frac{b_{min}-a_{max}}{s},\qquad
u_2=\frac{b_{max}-a_{min}}{s}
$$

Intersect `[min(u1,u2), max(u1,u2)]` over all axes and with `[0,1]`. A nonempty interval means a collision; touching counts as a hit under the existing tangent policy. A zero projected displacement with already-separated intervals rejects the pair. Production code needs scale-aware numerical tolerances and validated finite geometry; the disposable probe is not the production implementation.

Use relative displacement `shardDelta - playerDelta`, preserving moving-player crossings. Apply the query separately to the existing outward/reversal/expiry segments with the matching interpolated player motion. Test birth-time overlap, keep stable shard processing order and `hasHitPlayer`, and retain lifetime-only expiration. For arena constraints use transformed polygon vertices, not the old collider radius as the final wall shape.

This keeps visible geometry and actual collision consistent while respecting the eight-side limit. It is preferable here to pixel-perfect masks, many tiny component colliders, or an enclosing circle as the final test. It does not introduce a generic custom physics engine.

### 7.6 Checks Performed And Next Execution Order

Performed in this follow-up: broad/highlight region measurements, principal-axis estimates for two separate shard instances, explicit selected-projectile centroid/leading-pixel distances, native-size annotation review, unchanged-source verification, both dimensional calibration tables, and a disposable eight-case swept-SAT math probe. The probe passed: fast crossing, separated miss, tangency, equal-motion separation, initial overlap, a circle-overlap/polygon-miss case, rotated-coordinate equivalence, and reverse-direction crossing. No collision implementation or app test is claimed from this math probe.

Priority order after the R decisions: use section 7.8's scale -> define original shared convex vertex data -> review the common-scale body/edge diagram -> derive exact reversal from those vertices -> implement/test continuous collision and exact arena contact together under v2 -> apply approved cadence/spawn -> then zoom, health bar, hit feedback and modal/Paused presentation. Do not let independent UI enhancements delay or disguise geometric calibration. The feature and range decisions are recorded; do not ask the original question batches again.

Production acceptance must additionally cover numerical near misses, high-speed relative motion, rotation invariance, renderer/collider transform equality, every generated polygon's convexity/vertex count, newborn overlap, once-only return hits, lethal ordering, circle-wall contact, schedule equivalence and the new lifetime-dependent resource bound. At the approved 2.5-second group period the conservative bound is `44 * ceil(lifetimeSeconds / 2.5)`, giving 44 or 88 for the two table lifetimes. This is a bound, not a required observed peak or a universal performance guarantee.

### 7.7 Follow-Up Decisions Recorded - 2026-10-25

The user answered R01 explicitly and selected the recommendations for R02-R05. The decisions below supersede the earlier alternatives; they are not yet runtime changes.

| ID  | Recorded decision                             | Implementation precision                                                                                                                                                                                                                               |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R01 | "maximum distance from the head/leading edge" | Use 19.2 tiles from the head's simulation center to the projectile body's farthest edge. It includes emitter offset and body extent; it is not center travel or total path. Keep speed 8 tiles/second.                                                 |
| R02 | "use recommended"                             | Emission offset is 10% of calibrated head width, with four directional phases; propagate it through the reach/timing calculation.                                                                                                                      |
| R03 | "use recommended"                             | Three-tile enemy-center-to-wall spawn margin subject to actual polygon fit; geometry-derived pursuit stopping separation. No body blocking/contact damage is added. Any extra nonzero stopping gap remains unspecified, not a newly invented constant. |
| R04 | "use recommended"                             | Persist zoom within 0.25-3.0, default 1, step 0.125; preserve world scale independently of camera magnification.                                                                                                                                       |
| R05 | "use recommended"                             | Original quiet hit cue and visible mute; numerical gain/voice cap require audible review, and optional mute persistence is not treated as a mandatory saved setting.                                                                                   |

The source image, crops and annotation remain local reference assets; no public-art permission, commit, push or new live deployment is claimed. Range/emitter/spawn/zoom/audio-policy decisions are now settled. Exact original polygon coordinates, the approximate head contour, optional stopping margin and unspecified audio tuning remain implementation-review details, not unanswered repetitions of R01-R05.

### 7.8 Selected Leading-Edge Calibration

Under approved R01, the observed head-to-outer-pixel distance represents **19.2 tiles including the whole outward body extent**. Adopt the measured farthest pixel-center distance as the nominal spatial reference; the known pixel-footprint/anchor uncertainty remains. This is a provisional trainer calibration from the user's reference, not an exact recovered client measurement.

$$
S_{ref}=\frac{435.118}{19.2}\approx22.662396\text{ source pixels/tile}
$$

This scale replaces neither the meaning of a world tile nor the renderer's 32 CSS pixels/tile. It converts the measured proportions into world dimensions; zoom then controls their screen size.

| Quantity                                                  | Nominal derived value                                       |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Player body width x height                                | 1.588535 x 1.456157 tiles                                   |
| Visible head width x height                               | 1.853290 x 2.426928 tiles; contour still approximate        |
| Shard long x short dimensions                             | 2.496470 x 1.529406 tiles                                   |
| Emitter offset, 10% of head width                         | 0.185329 tile                                               |
| Maximum head-to-shard-centroid distance                   | 18.090453 tiles                                             |
| Observed radial outer-edge extension beyond that centroid | 1.109547 tiles; not an assumed half-length                  |
| Shard-center travel from emission to reversal             | 17.905124 tiles                                             |
| Projectile speed                                          | 8 tiles/second                                              |
| Nominal reversal age                                      | 2.238140 seconds                                            |
| Nominal symmetric lifetime                                | 4.476281 seconds                                            |
| Arena radius / diameter                                   | 19.2 / 38.4 tiles                                           |
| North enemy center spawn under the approved margin        | `(0, -16.2)` tiles, subject to final polygon-fit validation |
| Conservative live-shard bound with 2.5-second groups      | 88                                                          |

The center-travel and timing arithmetic includes the selected emitter offset:

$$
e=\frac{4.2}{S_{ref}},\qquad
d_{out}=\frac{409.973-4.2}{S_{ref}}\approx17.905124
$$

$$
t_{reverse}=\frac{d_{out}}{8}\approx2.238140\text{ s},\qquad
T=2t_{reverse}\approx4.476281\text{ s}
$$

These are **nominal screenshot-derived timing values**, not final hardcoded collision constants. The original asymmetric colored glyph's centroid/edge relation is not guaranteed to equal an original symmetric polygon's relation. Once the shared convex vertices are defined at these approximate dimensions, derive the exact allowable center position from the approved 19.2-tile outer-edge reach. Do not change the arena radius, distort the proportions, or ignore the emitter offset merely to retain a rounded lifetime.

For direction `n`, local transformed vertices `q_i`, parallel coordinate `p_i = dot(q_i,n)` and perpendicular squared distance `b_i^2 = ||q_i||^2 - p_i^2`, the outward center-position bound is:

$$
C_{max}=\min_i\left(\sqrt{19.2^2-b_i^2}-p_i\right),\qquad
t_{reverse}=\frac{C_{max}-e}{8},\qquad T=2t_{reverse}
$$

Validate the polygon fits at emission, each square-root argument is nonnegative, and `C_max > e`. This is the analytic form of the exact vertex-distance criterion in section 7.4 for straight translation with fixed orientation. It ensures the leading body **only touches** the arena boundary at reversal. Do not substitute a bounding-circle radius for the final polygon extent or round timing to the nearest 60-Hz tick; retain segment splitting at reversal and expiry.

The new world dimensions and collider shapes are comparison-breaking and belong to the approved v2 change set, not the current v1 runtime. No app code, simulation values, storage, source screenshot, commit or push was changed by recording these decisions.
