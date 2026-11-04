# Killer Bee Queen Phase 3 Observations

Measurement record from one tagged recording. This is the sibling of, and explicitly not part of, [the source extract](killer-bee-queen-source.md): that file holds wiki evidence and this one holds measurements of what one video showed. Nothing here is a design decision or an authorization to retune; it is evidence a later decision can use, and the decision itself stays with the user.

## Provenance And Access Method

Recorded from the committed export [killer-bee-queen-observations.json](killer-bee-queen-observations.json). The four provenance fields, as captured by the tagger:

| Field | Value |
| --- | --- |
| `sourceUrl` | `https://www.youtube.com/watch?v=TFclwuPtC94` |
| `fileName` | `killer-bee-queen-solo-nest-TFclwuPtC94.mp4` |
| `frameRate` | 60 |
| `durationSeconds` | 565.7 |

`encounterId` is `killer-bee-queen` and `recordedAt` is `2026-11-03T21:54:01.659Z`. The user drove the tagging run and exported the file; the agent placed it verbatim and derived the summaries below.

Tag times are seconds from the start of the video, so each maps onto a `&t=` parameter for the source. The video itself is not committed, per V8's T17.

Two frame-rate facts are recorded here because they differ and neither is a defect in the timings:

- `frameRate: 60` is the value the tagger recorded, which is its default step setting (`DEFAULT_FRAME_RATE`). Per T19, that field sets the step size only and never derives a recorded time.
- Every tag time lands on an exact 1/30 s grid, which is the video's presented-frame spacing (phase 33 records the same video as 30 fps). Each reading therefore carries at most 33 ms of quantisation. Recorded times come from `mediaTime`, so this does not affect them.

The JSON is raw evidence and was not edited. The frame-rate field is reported as exported rather than corrected, per T33.

## Calibration

The anchor is the source extract's phase 3 Red Glaive wave: the armour-break wave at phase start and every 7 seconds ([the source extract](killer-bee-queen-source.md)'s prose table, row 3).

Phase 33 measured the same wave by the endpoint method and recorded three readings of about 343.5 s, 350.5 s and 357.5 s from video start, giving `(357.5 - 343.5) / 2 = 7.0 s` with a 0.0 s deviation. Those were approximate readings ("about"), not frame tags.

The tagged run records the same wave at 343.733 s, 349.733 s and 355.767 s. Its two intervals are 6.000 s and 6.033 s, a mean of 6.017 s and a population standard deviation of 0.017 s.

The T12 cross-check, as three numbers without a new tolerance:

- Tagged mean: **6.017 s**
- Phase 33's hand-measured mean: **7.0 s**
- Difference: **0.983 s**

The tagged mean is 0.983 s below the wiki anchor's 7.0 s target, so this run does not reproduce the anchor within T02's ±0.25 s band. The user re-watched the footage after the tagging run and reports that the waves are about 6 seconds apart. The reading therefore points at the anchor value derived from the wiki's prose, not at the tagger's clock: the two tagged intervals agree to 33 ms, which is the tagger's resolution.

This is recorded as a calibration finding about this video and this anchor. It does not invalidate the export, because validation is structural only (T31), and it does not retroactively fail phase 33's user-accepted gate (T36), which used the approximate endpoint readings.

## Measured Cadences

Generated from the committed export by a throwaway script driven by `summarizeTags`, so the table and the tool agree by construction. Groups are ordered by sprite, then kind.

| Sprite | Kind | Sample count | Mean interval (s) | Standard deviation (s) |
| --- | --- | ---: | ---: | ---: |
| `bee-shot` | `rotating-arm` | 10 | 1.220 | 1.453 |
| `blue-ball` | `rotating-arm` | 35 | 0.405 | 0.021 |
| `red-ball` | `rotating-arm` | 35 | 0.405 | 0.021 |
| `red-glaive` | `rotating-arm` | 2 | 6.017 | 0.017 |
| `white-bomb` | `rotating-arm` | 5 | 3.060 | 0.365 |
| `yellow-ball` | `rotating-arm` | 5 | 2.513 | 0.117 |

### Raw intervals

`bee-shot` / `rotating-arm` — 10 intervals, seconds:

0.033, 0.033, 3.000, 0.033, 3.000, 0.033, 3.033, 0.033, 2.967, 0.033

`blue-ball` / `rotating-arm` — 35 intervals, seconds:

0.400, 0.433, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.333, 0.400, 0.400, 0.433, 0.400, 0.467, 0.367, 0.400, 0.400, 0.400, 0.400

`red-ball` / `rotating-arm` — 35 intervals, seconds:

0.400, 0.433, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.400, 0.433, 0.400, 0.400, 0.400, 0.333, 0.400, 0.400, 0.433, 0.400, 0.467, 0.367, 0.400, 0.400, 0.400, 0.400

`red-glaive` / `rotating-arm` — 2 intervals, seconds:

6.000, 6.033

`white-bomb` / `rotating-arm` — 5 intervals, seconds:

2.333, 3.300, 3.233, 3.233, 3.200

`yellow-ball` / `rotating-arm` — 5 intervals, seconds:

2.667, 2.433, 2.633, 2.367, 2.467

### Reading The Intervals

- `bee-shot`'s 10 intervals contain four 0.033 s repeats: the same visible burst was tagged two or three times on consecutive stepped frames. Its five burst starts are 344.633, 347.700, 350.733, 353.800 and 356.800 s, which are about 3.0 s apart. Its mean interval of 1.220 s is a property of the repeat tags, not of the attack, and should not be read as a cadence.
- `blue-ball` and `red-ball` share identical tag times: every volley was tagged as blue and red at the same frame. The 0.405 s mean is 26 intervals at 0.400 s, six at 0.433 s and three larger slips (0.333, 0.367, 0.467 s); the median and the mode are 0.400 s.
- `blue-ball`'s arm count is 6 in 29 volleys and 3 in 7 volleys. The 3-count volleys occur at 345.467, 347.100, 348.733, 350.333, 351.967, 353.600 and 355.133 s: a spacing of 1.53–1.63 s (mean 1.61 s), four volleys apart, which is the two counter-rotating 3-arm spirals coinciding. The wiki describes exactly that structure ([the source extract](killer-bee-queen-source.md), phase 3).
- `white-bomb`'s first interval, 2.333 s, does not match its four later intervals of 3.2–3.3 s; the first tag is earlier than the barrage's steady rhythm. The steady read is about 3.2 s.
- `yellow-ball`'s five intervals vary by ±0.15 s around 2.5 s, consistent with the 33 ms tag resolution plus a frame of press error.
- `red-glaive` is the tightest group in the run: two intervals, both within 33 ms of 6.0 s.

## Phase-To-Projectile Binding

Six sprite ids were observed in phase 3: `blue-ball`, `red-ball`, `yellow-ball`, `white-bomb`, `bee-shot` and `red-glaive`. The phase authors seven attacks because two of them use `blue-ball`:

| Observed sprite | Authored attack in `enemies.json` | Correspondence |
| --- | --- | --- |
| `blue-ball` | `blue-ball-spiral-cw` and `blue-ball-spiral-ccw` | Certain that the sprite is phase 3's blue pair; the tags cannot separate the two spirals from each other |
| `red-ball` | `red-ball-spiral-cw` | Certain |
| `yellow-ball` | `yellow-ball-ring-frequent` | Certain |
| `bee-shot` | `bee-shot-burst-occasional` | Certain |
| `white-bomb` | `white-bomb-compass-ring` | Certain that white bombs belong to this attack; the arm count is observed, the ring geometry is not |
| `red-glaive` | `red-glaive-wave` | Certain |

This is one recording of one phase, not a general rule. A sprite that is absent here was not necessarily absent from the encounter; this run says nothing about the other seven phases (D22).

It narrows, but does not close, the source extract's "Known ambiguity": the wiki gives no way to bind a projectile row to a phase, and this run binds six sprite ids to phase 3. It does not choose between variants that share a sprite (D19): `blue-ball` covers `blue-ball-v1`, `-v2` and `-v3`; `white-bomb` covers `-v1` and `-v2`; `red-glaive` covers `-v1` and `-v2`. Picking one would record a guess.

## Confidence And Limits

- **Sample counts are small in four groups.** Blue and red have 35 intervals; yellow and white have 5; the glaive has 2. The sample count is shown beside every row so a reader can judge for themselves. T29 removed outlier detection, and the raw lists are included so a doubled or missing tag is visible.
- **No variant resolution.** A sprite may cover more than one projectile variant (D19). The tags record sprites, not variants.
- **No angle, cone or rotation data.** Arm bearings, cone widths and rotation rates were out of scope (D20). The blue 3-vs-6 reading shows that the two spirals coincide, not how fast they turn.
- **One phase only.** The other seven phases were not measured (D22).
- **The observed phase duration is not an authored value.** How long phase 3 lasted in this video depends on that group's damage output, not on the Queen's configuration, and must not be read as a property of the encounter.
- **One recording, one player.** The tags are one player's reading of one run; another recording could show different counts, especially for the white bomb count.

## Relationship To Authored Data

For each measured group, this is the authored attack it corresponds to and that attack's current `tuningSource`. Differences are observations, not corrections: this document does not propose a new authored value. T32 stops the derivation at measured intervals, T08 kept V8 from writing authored data, and the retuning decision is held under D13.

| Measured sprite | Attack id | Current `tuningSource` | What the measurement shows |
| --- | --- | --- | --- |
| `blue-ball` | `blue-ball-spiral-cw`, `blue-ball-spiral-ccw` | `trainer-authored` | Volleys at a 0.400 s median, six balls except every fourth volley, when the arms coincide and read as three |
| `red-ball` | `red-ball-spiral-cw` | `trainer-authored` | Two balls per volley, same 0.400 s median as blue |
| `yellow-ball` | `yellow-ball-ring-frequent` | `trainer-authored` | About 8 balls per ring, about every 2.5 s |
| `bee-shot` | `bee-shot-burst-occasional` | `trainer-authored` | A 4-way burst about every 3.0 s; repeat tags are frame steps of one event |
| `white-bomb` | `white-bomb-compass-ring` | `trainer-authored` | 4 bombs per volley, steady rhythm about 3.2 s |
| `red-glaive` | `red-glaive-wave` | `wiki-prose` | 60 glaives per wave, about every 6.0 s |

The white-bomb count is the one place where the footage and the wiki's prose disagree: the source extract describes white bombs "along the cardinal/intermediate directions", which implies eight, while every tagged white-bomb event shows four. Both facts are recorded; neither is silently dropped, and choosing between them is the retuning decision's business, not this document's.

The glaive count for the wave is likewise a measured observation. The source extract describes the wave's existence and its Armor Break but gives no projectile count.

## Was This Worth Repeating

Yes, with two changes before the remaining phases are measured under D22.

**What the format gave a future decision.** A per-sprite period with a sample count for every attack visible in phase 3, a raw interval list a reader can audit, and two findings that hand measurement had missed: the blue pair's 3-vs-6 coincidence is a regular four-volley pattern, and the glaive wave's tagged spacing is about 6.0 s rather than the wiki's 7 s. The T12 cross-check earned its place by producing that second finding.

**What was awkward or ambiguous while tagging.**

- A single visible event can span two or three stepped frames. The bee burst was tagged on consecutive frames, which inflates a naive mean interval; the same risk exists for any very short burst.
- Overlapping balls hide an arm count. When the two blue spirals coincide, the player sees three balls, not six; the `shots` number records what was visible, which is the honest reading but not the projectile count.
- Variants that share a sprite cannot be told apart by eye (D19), so the run cannot choose among them.
- The run is a single sitting with no import or resume (T30), and frame-stepping a nine-minute video is slow. A run that stops without exporting loses its work.
- The recorded `frameRate` field is the tagger's step setting, not the video's presented rate. A reader who treats it as the video's rate would be wrong; the timings are not affected, but the field is misleading.

**What would need to change before the remaining phases.** A way to mark one visible event across several frames so a burst is one tag rather than three, or a rule that says which frame of the burst is tagged; and a decision on whether the provenance frame-rate field should record the presented rate instead of the step setting. Neither needs new gameplay data, and both are tooling/discussion items rather than cadence values.
