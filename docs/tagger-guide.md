# Tagger Guide

The tagger is a development-only tool for measuring a monster's fight from a gameplay video. You mark what you see on a timeline over the video; the tagger derives the numbers from those marks and shows them beside the authored values, and you accept the ones you trust. Its output is a monster file text and a study JSON, both copied or downloaded by hand. It never uploads the video and never changes the game.

## Open it

Run `npm run dev` from `app/` and open the dev URL with `?tagger=1`, for example `http://localhost:5173/?tagger=1`.

The work is split into four steps, shown in the step bar: Set up, Structure, Attacks and Reconcile. The numbers show the usual order, not a gate; every step stays available. The Step guide button explains the current step, and the Glossary button lists every term below.

## Terms

Every term is defined in the tagger's Glossary dialog; the list below mirrors it.

- **Study**: Everything recorded for one monster on one video: its structure, status, attack tracks and scratch marks. It autosaves per video and monster.
- **Video clock**: The video's own time. Every time in the tagger comes from it, never from a seek target.
- **Presented frame**: The video frame currently shown. A mark records the presented frame's time.
- **Frame rate**: How many frames the video presents per second. It is used only to step one frame at a time.
- **Phase**: A stage of a monster's fight, entered at a health fraction. A monster's attacks are authored per phase.
- **Sub-phase**: A part of a phase with its own telegraph, duration and attacks. Sub-phases cycle in order while the phase lasts.
- **Segment**: The unit of structure: a phase with no sub-phases, or one sub-phase. Every attack belongs to one segment.
- **Boundary**: The frame a segment is entered. Press Segment starts here to add one. The same segment can be entered many times.
- **Window**: The stretch of video from a boundary to the next boundary or the video end. Attacks of that segment fire inside it.
- **Telegraph**: The warning time at the start of a segment, before its attacks fire. Press Telegraph ends here to measure it.
- **Invulnerable**: A stretch where the monster takes no damage. Record it as a span on the status track.
- **Track**: One row of the timeline. The structure track, the status track, one attack track per attack, and the scratch track.
- **Structure track**: The row holding boundaries and telegraph ends.
- **Attack track**: The row for one attack: its definition, its marks and its fit.
- **Status track**: The row holding spans such as invulnerable.
- **Scratch track**: The row for marks that belong to no attack yet. Create an attack from them later.
- **Selected attack**: The attack track that Enter records to. Press 1 to 9 to select one, 0 for the scratch track.
- **Mark**: One time-stamped observation on a track, at the presented frame.
- **Volley**: One firing, where all of an attack's projectiles leave together. Each volley is one mark.
- **Throw mark**: A bomb attack's volley mark: the frame the bomb leaves the monster.
- **Detonation mark**: The frame a bomb explodes. It pairs with the throw mark before it.
- **End mark**: The frame an attack visibly stops. It is a check only: the game runs an attack until its segment ends.
- **Span**: A stretch with an in and an out on the status track.
- **Attack**: A repeating firing of one projectile in one pattern with one cadence, belonging to one segment.
- **Attack definition**: An attack's projectile, pattern, aim and cadence, in the shape the game's monster file uses.
- **Projectile**: What an attack fires, from the game's projectile catalog: its sprite, speed, range and motion.
- **Pattern**: Where the shots go: a ring of arms, a spread across an arc, or a scatter inside a cone.
- **Aim**: What a spread or scatter points at: the player, the monster's front, or a fixed bearing.
- **Arm**: One spoke of a ring. An arm fires a single shot or a small pattern of its own.
- **Arm pattern**: What each arm of a ring fires: a single shot, a spread, a scatter or an inner ring.
- **Emitter**: The fixed point the preview fires from. It never moves, even for a monster that chases.
- **Bomb**: A projectile that flies for a set time, then explodes. It hits only by exploding.
- **Target**: A bomb thrown at the player's position. It lands there whatever the distance, so it has no range.
- **Cadence**: An attack's timing: shots per burst, shot interval, cooldown and initial delay.
- **Burst**: Several volleys close together, followed by a cooldown.
- **Shot interval**: Seconds between the volleys inside one burst.
- **Cooldown**: Seconds from a burst's last volley to the next burst's first volley.
- **Initial delay**: Seconds from the end of a segment's telegraph to the attack's first volley.
- **Burst gap threshold**: The gap length that separates a shot interval from a cooldown. The fit chooses it; you can override it.
- **Fit**: The cadence derived from a track's marks. Accept it to make it the attack's cadence.
- **Residual**: How far a mark lies from the nearest volley the fit predicts, in seconds. A large residual means the fit does not match the video.
- **Measured**: A value derived from marks on the video clock.
- **Estimate**: A value you typed by eye, such as a cone width. It is not a measurement.
- **Authored**: A value as it stands in the game's monster file.
- **Accepted**: A measured or typed value you chose to export in place of the authored one.
- **Preview**: The canvas beside the video that draws the study's volleys at the presented frame.
- **Observed volley**: A mark drawn as its attack, fired at the mark's time.
- **Ghost volley**: A volley the accepted cadence predicts, drawn faintly so you can compare it with the marks.
- **Scale calibration**: One drag across the monster's body on the video, so distances on the video can be read in tiles.
- **Range**: How far a bomb flies, in tiles, measured from the monster's centre at the throw to the explosion's centre.
- **Flight time**: Seconds from a throw mark to its detonation mark.
- **Reconcile**: The step where measured, typed and authored values sit side by side and you accept the ones to export.
- **Export**: Copying the monster file text, or the study JSON, to paste by hand. The tagger writes nothing.
- **Monster file**: The game's JSON file for one monster under game/data/enemies/.
- **Projectile variant**: A copy of a catalog projectile with a measured flight time or range, to paste into the projectile catalog by hand.
- **Warning**: A check the study fails, such as a mark outside its segment's window. Warnings never stop an export.

## Set up

1. Press **Open a video** and choose the local video file. It stays on your machine.
2. Type the video's presented **frame rate** (for example 30). There is no default. Check it against the real video: frame stepping uses it, the warnings measure "one frame" with it, and no mark can be recorded until it is set.
3. Optionally type the public source URL. Leave it blank for a local-only recording.
4. Choose the **Encounter** and the **Monster**. Choosing a monster starts a study whose attack tracks are that monster's authored attacks, one track per attack, in file order. Every monster the encounter reaches can be studied; each has its own study.

The study autosaves for this video file and monster. When you open the same video again, **Continue a saved session** lists the saved studies: **Restore** reopens one, **Discard** deletes it, and **Dismiss list** hides the list. A study from before the timeline converts when it is restored or loaded: its marks move onto attack tracks, and a notice asks you to check its boundaries.

## Structure

The Structure step records where each segment starts, how long its telegraph lasts and when the monster is invulnerable. Every later mark takes its segment from these boundaries, so mark them first.

- **Boundaries.** Seek to the frame a segment is entered and press **Segment starts here** (key `S`). The first boundary enters the monster's first segment; each next one is guessed as the segment after the previous boundary's, following the authored sub-phase cycle. If the guess is wrong, change the boundary's segment in its row; every later mark follows. A segment can be entered many times, and each entry gets its own window.
- **Telegraph ends.** At the frame the segment's attacks may begin, press **Telegraph ends here** (key `T`). It applies to the latest boundary at or before the presented frame. Without one, the authored telegraph is used.
- **Invulnerable spans.** Press **Invulnerable starts here** (key `I`) where the monster stops taking damage and **Invulnerable ends here** (key `I` again) where it takes damage again. The span appears on the status track and in the Invulnerable spans list with its length.
- **Scale calibration.** Press **Calibrate scale**, then drag across the monster's body at a frame where it is fully visible. The tagger stores one tile as a fraction of the video's width. It is only needed to measure a bomb's range. **Clear** removes it.

## Attacks

The Attacks step lists the **Attack tracks**. Select one by its number (keys `1` to `9`) or by clicking it; key `0` selects the scratch track.

- **Tracks.** Each track holds an attack definition in the monster file's shape. Edit its projectile, pattern, aim and cadence in the editor below the list, and its segment in the segment select. **Add attack** adds a new track with an id and a segment, **Duplicate** copies the selected track under a new id, **Delete** removes it after a second press, and **Reload from game** reloads the tracks from the monster file, keeping the ones that have marks.
- **Marks.** Seek to the frame a volley leaves the monster and press Enter. The mark goes on the selected attack, or on the scratch track when none is selected. The **Marks** table lists the selected track's marks; a time seeks there and Remove deletes one. Delete or Backspace removes the selected track's mark within one frame of the presented frame. Key `X` sets the selected track's end mark: a check only, because the game runs an attack until its segment ends.
- **The fit.** From the marks in their windows, the tagger fits a cadence: shots per burst, shot interval, cooldown and initial delay. Each row shows the measured value, the current value and **Accept**; **Accept all** takes every measured value. A cadence you accept is marked fitted; one you type is marked typed. The fit also reports how many volleys and complete bursts it used and the largest residual.
- **The threshold.** The fit splits gaps into shot intervals and cooldowns with a burst gap threshold. When the split is ambiguous, the threshold field shows; type a value to override it, or press **Set threshold** to show it anyway. A blank field clears the override.
- **Scratch.** When you cannot yet name the attack, select the scratch track and mark the volleys there. Later, tick the marks that belong together, give an id and press **Create attack from selected marks**.

The preview beside the video draws the observed volleys (each mark fired as its attack), the ghost volleys (the accepted cadence in its windows, drawn faintly), or both. If the ghosts sit on the marks, the cadence matches the video.

## Bombs

A bomb attack is marked twice per volley: Enter at the frame the bomb is thrown (a throw mark) and key `E` at the frame it explodes (a detonation mark). Each detonation pairs with the throw mark before it.

- **Flight time.** The Bomb section shows the number of pairs, the unpaired throw marks, and the median gap from throw to detonation beside the catalog's flight time. **Accept** under Flight time records it for this track.
- **Range.** With a scale calibration, each pair has a **Measure pair** button: it seeks to the throw and asks you to click the monster's centre, then seeks to the detonation and asks you to click the explosion's centre. The median of the measured pairs shows beside the catalog's range, and **Accept** under Range records it. A targeted bomb lands on the player, so its range is evidence only and cannot be accepted.

An accepted flight time or range is exported as a projectile variant, and the attack in the monster file names that variant.

## Reconcile

The Reconcile step puts what was measured beside what is authored. The step bar shows the number of warnings.

- **Warnings.** Each row names where the problem is (the structure, the status track or an attack track) and what it is: a mark outside every window of its track, an end mark before its window ends, an invulnerable span that does not start within one frame of a boundary, a cadence with a missing value, a fit whose residual is above two frames, or boundaries that do not follow the authored sub-phase cycle. Click a warning with a time to seek there. A warning never stops an export.
- **Segments.** Each segment that has a boundary shows its measured telegraph, invulnerable time and duration (sub-phases only), each the median over its boundaries, beside the authored value. **Accept** records a measured value for export; **Clear** withdraws it. A value shows "not measured" until there are marks for it.
- **Attacks.** A read-only list of every track: its segment, where its cadence came from (authored, fitted or typed), the four cadence values and, for a bomb, its accepted flight time and range. Change them in the Attacks step.
- **Export.** The monster file text shows in a read-only box: the monster's file with every attack list rewritten from the tracks and the accepted segment values applied. **Copy file** copies it; paste it over the file under `app/src/game/data/enemies/` yourself. Each bomb track with an accepted flight time or range has its own Projectile variant box and **Copy** button, to paste under `projectiles` in the projectile catalog. **Export study JSON** downloads the study itself, as evidence a later plan can cite.

## Keys

Keys work outside editable fields.

| Key | Action |
| --- | ------ |
| Enter | Add a volley mark to the selected attack (the scratch track when none is selected) |
| `E` | Add a detonation mark to the selected bomb attack |
| `S` | Segment starts here: add a boundary |
| `T` | Telegraph ends here, for the latest boundary |
| `I` | Invulnerable starts here, or ends here |
| `X` | Set the selected attack's end mark |
| Delete, Backspace | Remove the selected attack's mark at this frame |
| `1`-`9` | Select the attack track at that position |
| `0` | Select the scratch track |
| Space | Play or pause |
| ← → | One frame back or forward |
| Shift + ← → | Jump 5 seconds back or forward |
| PageUp, PageDown | Jump 30 seconds back or forward |
| `[` `]` | Previous or next volley mark |

## Limits

- The emitter is fixed: the preview fires from one point, even for a monster that moves.
- One monster is drawn: the preview shows only the studied monster's attacks.
- An attack cannot stop before its segment ends. An end mark is a check that raises a warning, never an exported value.
- The detonation radius is a catalog value; the tagger does not measure it.
- The game never reads a study. Only a pasted monster file or projectile variant changes what the game does.
- Pasting a file changes gameplay, so it is a separate approved change, with its rulesVersion and test updates.

## Worked example: a ring's cadence from six marks

A ring attack fires three volleys close together, then pauses. Its segment has a boundary at 12.000 s with a telegraph end at 14.000 s.

1. In the Attacks step, press `1` to select the ring's track.
2. Mark six volleys with Enter: 15.000, 15.400, 15.800, then 18.000, 18.400, 18.800 s.
3. The fit splits the gaps at the burst gap threshold: the 0.400 s gaps are shot intervals, and the 2.200 s gap is the cooldown from 15.800 to 18.000. It reads shots per burst 3, shot interval 0.400 s, cooldown 2.200 s, and initial delay 1.000 s (from the telegraph end at 14.000 to the first volley at 15.000), from 6 volleys and 1 complete burst (the last burst counts as complete only once a cooldown follows it).
4. Check the largest residual is well under a frame, then press **Accept all**. The track now shows fitted, and the ghost volleys in the preview sit on the marks.
5. In Reconcile, the Attacks list shows the ring with its cadence fitted. **Copy file** copies the monster file with the ring's new cadence; paste it over the file only as part of an approved change.
