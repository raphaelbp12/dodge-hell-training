# Plan V9: Phase 3 Retuned From Tagged Video Evidence

Phases 36. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phase 36 builds and why. It is not authorization to implement the phase by itself.

This plan applies the V8 measurement to the encounter. It changes phase 3 of the Killer Bee Queen and nothing else in gameplay.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phase 36. Later explicit user decisions override older statements; record changes here.
- [The design](superpowers/specs/2026-11-03-killer-bee-queen-phase-3-retune-design.md): the derivation, the fitted values and the judgement calls this plan implements.
- [Plan V8](plan-v8.md): the measurement capability and the evidence it produced. Its T31 keeps the evidence validator structural.
- [The source extract](killer-bee-queen-source.md): the wiki evidence. Where it disagrees with the footage, the footage wins and the conflict is recorded (U06, U15).
- [The mechanics contract](mechanics.md): the encounter and phase-machine rules in force.
- [The deferred register](deferred-work.md): D13 is promoted for phase 3 by this plan; D20 and D22 bound what is not inferred or measured.
- [The project instructions](../AGENTS.md): ownership, test discipline and verification.

## Preconditions

Phase 35 must be complete and V8 archived before phase 36 starts. That means:

- `docs/killer-bee-queen-observations.json` exists, is the unedited export, and passes `validateObservationExport`.
- `docs/killer-bee-queen-observations.md` exists with the script-generated tables from V8 35.2.
- T34's schema test reads the committed JSON, per V8 35.3.

Phase 36 does not repeat those steps; it consumes their output.

## Completed Baseline

At the start of phase 36 the Queen is authored under `killer-bee-queen-nest-paladin-v7`, and `phase-3-pond-barrage` carries seven attacks:

| Attack | Arms | Rotation | Period |
| --- | ---: | ---: | ---: |
| blue CW / CCW | 3 each | ±50°/s, 0°/60° | 0.84 s |
| red | 2 | +40°/s | 1.05 s |
| yellow | 6 | 0 | 0.70 s |
| bee | 4 | 0 | 5.00 s |
| white bomb | 8 | 0 | 2.80 s |
| red glaive | 8 | 0 | 7.00 s |

## Approaches Considered

The design considered three. A direct retune was chosen. Building a reusable export-to-cadence derivation in `research/` was rejected because V8's T32 forbids it and it delays the playable change; a partial retune was rejected because the open interpretation questions are already resolved and a half-tuned phase is harder to judge in play.

## Confirmed Design

- All seven phase-3 attacks get their measured arms, periods and rotation, and every one gets `tuningSource: "video-observation"`.
- The two blue spirals remain two 3-arm attacks with a 60° initial offset, counter-rotating at ±37.5°/s, firing every 0.40 s. They interleave into six balls and coincide into three every fourth volley, a 1.6 s beat.
- Every phase-3 attack keeps `initialDelaySeconds: 0`, so the barrage starts on the phase epoch and the volleys the recording shows together fire together.
- The Queen's `rulesVersion` advances to `killer-bee-queen-nest-paladin-v8`, retaining older attempts but excluding them from the new best.
- The 24.2 tuning guard keeps its history; the glaive assertions move to a new V9 guard.
- The evidence is cited, not edited. No projectile, condition, hitbox, movement, telegraph, threshold or other phase changes.

## Named Constants

Stated once here. Phase files reference the decision id rather than repeating the value.

| Value | Constant | Decision |
| --- | --- | --- |
| Blue and red period | 0.400 s | U03 |
| Yellow period | 2.500 s | U03 |
| Bee period | 3.040 s | U03 |
| White bomb period | 3.230 s | U03 |
| Glaive period | 6.020 s | U03 |
| Blue rotation | ±37.5°/s | U04 |
| Blue initial phases | 0° and 60° | U04 |
| Red rotation | +40°/s (unchanged) | U07 |
| Yellow arms | 8 | U03 |
| Bee arms | 4 | U03 |
| White bomb arms | 4 | U06 |
| Glaive arms | 60 | U03 |
| Queen rules version | `killer-bee-queen-nest-paladin-v8` | U10 |
| New tuning source | `video-observation` | U09 |

## Target Data Shapes

`validTuningSources` in `app/src/game/config/data.ts` gains one literal:

```ts
const validTuningSources = [
  "approved-v3",
  "wiki-prose",
  "trainer-authored",
  "video-observation",
] as const;
```

Each phase-3 attack in `app/src/game/data/enemies.json` keeps its id, projectile and `shotsPerBurst: 1` / `shotIntervalSeconds: 0.1`, and carries the named constants:

| Attack id | Arms | `clockwiseDegreesPerSecond` | `initialPhaseDegrees` | `cooldownAfterLastShotSeconds` |
| --- | ---: | ---: | ---: | ---: |
| `blue-ball-spiral-cw` | 3 | 37.5 | 0 | 0.4 |
| `blue-ball-spiral-ccw` | 3 | -37.5 | 60 | 0.4 |
| `red-ball-spiral-cw` | 2 | 40 | 0 | 0.4 |
| `yellow-ball-ring-frequent` | 8 | 0 | 0 | 2.5 |
| `bee-shot-burst-occasional` | 4 | 0 | 0 | 3.04 |
| `white-bomb-compass-ring` | 4 | 0 | 0 | 3.23 |
| `red-glaive-wave` | 60 | 0 | 0 | 6.02 |

## Recorded User Decisions - 2026-11-03

- **U01 - Scope: phase 3 only.** D13 is promoted for phase 3; the other seven phases stay deferred under D22.
- **U02 - The tagged export is authoritative evidence.** Fitted periods, not copied intervals.
- **U03 - Period and count values.** See Named Constants. Blue and red use the median 0.400 s; the others use fitted or steady-state values rounded to 0.01 s.
- **U04 - Blue overlap model.** Two 3-arm spirals at ±37.5°/s with a 60° offset reproduce the observed 3-vs-6 pattern and its 1.6 s beat.
- **U05 - Bee bursts are one volley.** The two or three same-frame tags per event are one visible burst stepped, not three volleys.
- **U06 - White bombs are 4 per volley.** The user confirmed the footage; the wiki's cardinal/intermediate (8) is recorded as a conflict.
- **U07 - Rotation stays authored where unmeasurable.** Red keeps +40°/s; yellow keeps 0. D20 bounds this.
- **U08 - Epoch alignment.** All phase-3 attacks use `initialDelaySeconds: 0`; the recording's 0.9 s glaive lead is not adopted because the phase-entry instant is not identifiable from the tags.
- **U09 - A new `tuningSource`: `video-observation`.** It means "fitted from the tagged recording, see `docs/killer-bee-queen-observations.md`".
- **U10 - Comparison-breaking rules version.** The Queen advances v7 → v8; pre-retune attempts are retained but excluded from the best.
- **U11 - V8 finishes first.** V8 phase 35 completes and is archived before V9 phase 36 starts.
- **U12 - Corrections are appended, not rewritten.** Phase 33's 7.0 s figure, its archive and T36's text stay intact; a dated correction records the 6.02 s measurement.
- **U13 - The 24.2 guard is split, not overwritten.** Its phase-7 and projectile assertions stay; the glaive guard becomes a V9 test.
- **U14 - Verification.** Focused Vitest per step; `npm run verify` once at the end; the phase-3 drill Playwright case once. No full e2e suite. No commit, push or deployment without explicit authorization.
- **U15 - The wiki's 7 s glaive cadence is superseded by the measured 6.02 s.** The wiki still sources the wave's existence and Armor Break.

## Architecture

No new boundary and no production module. The change lives in the existing authored-data, config and documentation homes:

| Concern | Home |
| --- | --- |
| Tuning-source vocabulary | `app/src/game/config/data.ts` and its test |
| Phase-3 authored values | `app/src/game/data/enemies.json` |
| Comparison identity | `app/src/game/data/encounter.json` |
| Behavioural guards | `app/src/game/config/config.test.ts`, `app/tests/app.spec.ts` |
| Records | `docs/mechanics.md`, `docs/deferred-work.md`, `README.md`, `docs/plan-v8.md` |

## Review Focus

- **The barrage's shared epoch.** All seven attacks start on the phase epoch; if one delay changes, the recorded alignment disappears silently. Pinned in 36.2 by asserting every phase-3 delay is 0.
- **The blue 3-vs-6 overlap.** The two rings still spawn six shards, two on a bearing when coincident; the pattern is geometric, not a count change. A wrong offset or rate moves or removes the 1.6 s beat. Pinned in 36.2 by the rate and phase assertions.
- **Tuning-source validation.** A new literal must not loosen rejection of unknown sources. Pinned in 36.1.
- **Pre-retune history.** A v7 attempt must stay visible in history but out of the v8 best. Pinned in 36.3.
- **Density and frame cost.** Sixty glaives and about 34 balls/s may approach the derived shard bound and the old frame figures. The drill in 36.5 measures it; it is not a bound to widen.

## Approved Scope And Review Gates

- Only the seven `phase-3-pond-barrage` attacks, the Queen's `rulesVersion`, the tuning-source literal and their records change. No projectile stat, condition, hitbox, movement, telegraph, threshold, arena value or other phase changes.
- The evidence files are never edited. Values cite them; they do not become runtime data.
- Tests that encode old tuning are rewritten to the new values and relationships, never deleted. The 24.2 historical assertions stay.
- No live-shard or performance bound is widened. Bounds stay derived from configuration.
- The blue pair stays two attacks. Authoring one 6-arm ring is out of scope because it cannot reproduce the 3-ball overlap.
- Focused Vitest per step; `npm run verify` once at the end; `npm run test:e2e -- --grep "Queen phase-3 drilled"` once. No full Playwright suite.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 36 | The Phase-3 Retune | complete | V8 phase 35 |

## Phase 36: The Phase-3 Retune

Status: complete. Dependencies: V8 phase 35. Steps in [`docs/plan-archive/phase-36.md`](plan-archive/phase-36.md).

Retuned phase 3's seven attacks to the tagged recording, advanced the Queen to `killer-bee-queen-nest-paladin-v8`, rewrote the coupled tests, fixed the drill's phase selection, and recorded the change. Complete: the seven attacks cite `video-observation`; the blue pair is ±37.5°/s at 0.40 s with the 1.6 s beat; the phase's real browser drill peaks at 112 shards and 1,256 parts; `npm run verify` passed all four gates; the full fight still clears at 373.43 s; the playtest remains outstanding.
