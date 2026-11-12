# Tagger Guide

The tagger is a development-only tool for recording when and how a boss fires shots in a gameplay video. Its output is an observation file that later plans cite as evidence. It never uploads the video and never changes the game.

## Open it

Run `npm run dev` from `app/` and open the dev URL with `?tagger=1`, for example `http://localhost:5173/?tagger=1`.

## Terms

- **Volley:** one firing, where all of its projectiles leave together. Each volley is one tag.
- **Burst:** several volleys close together, followed by a pause.
- **Pattern:** where the shots go. Choose `rotating-arm`, `fixed-ring`, `spread` or `scatter`. A loaded legacy tag may show `volley`, which cannot be chosen for new tags.
- **Aim:** `player`, `fixed` or `front`. It exists only on `spread` and `scatter`. `front` means the shot is aimed relative to the enemy's front (its movement heading). By default the tag records only that, but you can type a **front offset**, and for `fixed` a **bearing** (see Typed estimates).
- **Shots / arms:** the number of projectiles in the volley, or the number of arms for a ring or rotating arm.
- **Arm pattern:** what each arm of a ring fires: a single shot (the default), a `spread`, a `scatter`, or another `ring`. Only `rotating-arm` and `fixed-ring` tags have one, and a tag describes one level only; deeper nesting is authored in the monster's file.
- **Shots per arm:** how many shots each arm fires (for an inner ring, how many inner arms).
- **Monster draft:** a working copy of one monster's attacks, loaded from the game and edited in the tagger. It is never read by the game.
- **Telegraph:** the warning time at the start of a phase or sub-phase, before its attacks begin firing. The **Glossary** button in the tagger header defines every term used here.
- **Block:** a phase with no sub-phases, or one sub-phase. Each block has its own **Starts here** anchor.
- **Anchor:** the video time at which a block is entered. It aligns a study with a video and is never exported.
- **Typed estimates:** the cone width of a spread or scatter arm, a rotating arm's clockwise degrees per second and initial phase, a spread or scatter's own **cone**, a `fixed` aim's **bearing**, a `front` aim's **offset**, a ring's **emitter radius**, a bomb's **range** and **flight time**, and a bullet's **speed** and **range** are numbers *you type*. They are estimates, not measurements from the video, and the preview and export treat them as such. A blank field means "use the matched attack's authored value". A field appears only where it applies: a cone on a spread or scatter, a bearing with aim `fixed`, an offset with aim `front`, a radius on a ring, bomb fields for a bomb sprite, and bullet speed and range only when the matched projectile is a `linear` bullet. A `fixed` tag with no typed bearing uses the matched attack's bearing when that attack is fixed; otherwise it is not drawn and cannot export, and the status says it needs a bearing.

## First session

1. Choose the local video file. It stays on your machine.
2. Type the video's **presented frame rate** (for example 30). There is no default. Check it against the real video, because frame stepping uses it and the export records it. Recording, frame stepping and export are all blocked until it is set.
3. Optionally type the public source URL. Leave it blank for a local-only recording.
4. Pick the encounter. The page title names it. Changing the encounter later asks you to confirm, then clears the tags and saved attacks; Cancel changes nothing.

## Tagging

Seek to the exact frame where a volley first appears. Set the sticky selection (sprite, phase, pattern, aim if shown, shots, and for a ring the arm pattern with its shots per arm, cone width, rotation rate and phase), then record. Changing the pattern keeps your arm and rotation choices, but a new tag only takes the ones its pattern allows. A ring tag gets its arm pattern only when shots per arm (and a cone width for spread or scatter) are set. The recorded time is the presented frame's time, not the seek target, so after any seek wait for the frame to appear.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left / Right | Step one frame |
| `[` / `]` | Seek to the previous / next volley (every volley, including each volley of a repeat; no frame rate needed) |
| Shift + Left / Right | Jump 5 seconds |
| PageUp / PageDown | Jump 30 seconds |
| Enter | Record a standalone tag |
| B | Record a volley and start a new burst |
| Shift + Enter | Record a volley and add it to the latest matching burst |
| 1 to 9 | Set the shot count |

The **timeline** under the transport is a bar over the whole video: drag it to scrub, type a time in **Go to time** and press Enter, and read the gold marks as one per volley. It seeks through the same path as the buttons, so recording still waits for the presented frame.

Holding a record key does not repeat. Keys are ignored while a text, number or select field is focused.

### Standalone tags and bursts

Use **Enter** for a shot that is not part of a burst.

For a burst, press **B** on its first volley, then **Shift + Enter** on each further volley. A continuation attaches to the highest burst id with the same phase, sprite, pattern, aim and arm pattern. If none exists, the tool shows an error and records nothing. To tag two interleaved bursts, change the sticky selection between them.

The readout beside the record button shows the interval since the previous tag in the current group. The Summary panel shows the whole study. A group with bursts reports `between-bursts` intervals (start to start) and `within-bursts` intervals separately. A group without bursts reports one `all` result. The tool derives no cadence values; mapping them to game tuning is a separate decision.

## Correcting mistakes

The Tags list shows the newest footage first. Every field in a row can be edited in place, and geometry inputs carry a short visible label. The actions column stays in view at the right. **Use these settings** copies a row's phase and attack fields (and its saved attack, if any) into the sticky selection, so the next tag matches it. Each row also shows a **Preview** badge with the same text as the Tag panel's match status. A rejected value (for example a time outside the video, or a non-integer burst) shows an error and leaves the tag unchanged.

- Editing a time marks the tag `typed`, and the mark never clears. Delete and re-record the tag to get a frame-derived time back.
- Clearing the Burst field removes the burst id.
- A ring row has a **Geometry (typed)** cell: choose its arm pattern (a spread or scatter arm asks for a cone width), shots per arm, and for a rotating arm its rate and phase. Clearing a rotation field removes the typed value. Changing a tag's pattern drops the fields the new pattern cannot have.
- **Go to** seeks the video to that tag's time.
- **Export as attack** shows the tag as an attack you can paste into the monster's file under `app/src/game/data/enemies/` (see below).
- **Delete** removes a row. There is no undo.

## Saving and resuming

Work is saved to browser storage automatically after the first tag or edit, with one slot per video file name. Reopening the tagger lists saved sessions with restore and discard. Nothing is removed unless you discard it. A failed save shows an autosave error and tagging continues, so export if you see one.

To continue from an exported file, use **Load study**. Loading replaces the current tags after you confirm. Then choose the video; the first video chosen after a load keeps the tags. A mismatch between the study's file name and the chosen video only warns, and the next export uses the open video's file name and duration.

Without a video you can still load, edit and export a study, but you cannot record, step or seek.

A v1 file (from the first pilot) loads with a blank frame rate. Enter the presented rate before exporting.

## Exporting

Press **Export JSON**. The file is `<encounter-id>-observations.json`, schema version 3 (saved attacks and tags), tags sorted by time. Files of versions 1, 2 and 3 all load; older ones upgrade in memory. Move it into `docs/` by hand if it is evidence. Do not edit committed evidence files; load them, correct them and export a new version instead.

## Preview

A square preview sits to the right of the video. It follows the presented video frame, so play, pause, frame steps, jumps and seeks all move it with no extra controls. While a seek is pending it keeps showing the previous presented frame.

The preview shows your tags played with the game's current geometry, not geometry measured from the footage. Each tag borrows its speed, motion, range and emitter offset from the matching authored attack: the first attack in the tag's phase that fires the tag's sprite in the same pattern family. A composite tag therefore matches a plain ring. The tag's own geometry wins: its arms, arm pattern, shots per arm, cone width, aim and typed rotation replace the attack's, and a tag with no arm pattern draws single-shot arms even when the authored attack is a composite. Scatter shots are spread evenly across the cone instead of randomly.

**Rotation.** A `rotating-arm` tag's arm 0 points at its phase plus its rate times the time since the *first tag of its group* (same phase, sprite, pattern, aim and arm pattern). Each of rate and phase is the value you typed on that tag, otherwise the matched attack's authored value, so existing tags now rotate at the authored rate. The first tag of a group fires on its phase. A `fixed-ring` tag never rotates, even on a rotating attack; it only chooses where each volley fires. Per-burst advance and arm spread are not drawn: an advancing attack shows every burst at the same angle unless you type a different phase on that tag.

A tag with no matching attack, an unknown sprite or phase, or the `volley` pattern is not drawn. The panel shows "N tags not previewed" under the canvas when any such tag exists. **Match status:** before you record, the Tag panel says what a tag built from the current selection would do: `Plays as <attack id>`, or `Won't preview: <reason>`. Each row's badge says the same, and an export refusal repeats the reason.

- **Player sliders.** The x and y sliders place the player point, which player-aimed spread and scatter volleys aim at. It starts at the encounter's player spawn and resets when you reload or change the encounter. A bomb tag with **Targets the player** ticked lands on this point, because the game captures the player's position when it fires and the preview has no recorded position. The tag decides, not the matched attack: a bomb tag without it stops at its range along the aim.
- **Enemy heading slider.** Sets the direction the enemy faces, in degrees from 0 to 360, and shows it as an arrow on the emitter. It turns *only* `front`-aimed shots: rings and `fixed` shots stay absolute, as they are in the game. There is one value for the whole study; it starts at the archetype's initial heading (or 0) and resets on reload.
- **Zoom and pan.** The mouse wheel over the canvas zooms 1×, 2× and 4× about the cursor, dragging pans within the arena, and Reset view returns to the fitted view.
- **Size and visibility.** Hide preview collapses the panel; Small, Medium and Large set a 320, 480 or 720 pixel square. Only visibility and size are remembered across reloads.
- **Burst highlight.** Clicking a tag row seeks the video and outlines every volley of that tag's burst, or just that tag when it has no burst. The outline stays while you scrub; click another row to move it, or the same row to clear it.

Without an open video the canvas is black with a note asking you to open one.

## Exporting a tag as an attack

Click **Export as attack** on a row to show that tag as the JSON of an authored attack, in a read-only box with a **Copy JSON** button. If the browser blocks copying, select the text by hand. Nothing is ever written to a file: paste the JSON into the right archetype's `attacks` in its file under `app/src/game/data/enemies/` yourself.

The exported attack is exactly what the preview draws for the tag: the arms, arm pattern, typed cone, aim and rotation, with the pattern's phase written back as `initialPhaseDegrees`. Because the phase is measured at the *first tag of the group* rather than the game's clock start, adjust it if the attack's clock starts elsewhere. The id is the matched attack's id plus `-tagged`; the projectile and cadence are copied from the matched attack (the tool never derives cadence from your tagged intervals); and `tuningSource` is `video-observation`. A tag with no matching attack cannot export. A `front`-aimed export carries a note: its archetype also needs `initialHeadingDegrees`.

To tag, preview and export a ring of spreads: choose a `rotating-arm` or `fixed-ring` pattern, set the arm count, choose arm pattern `spread`, set shots per arm and a cone width, record, check the preview, then select the row's **Export as attack**.

## Bombs

A bomb sprite shows extra controls. **Targets the player** is enabled only for a one-shot `spread` with aim `player`; the control says why when disabled. A targeted bomb lands on the player at any distance, so **range is disabled and ignored**; **flight time** still applies. Otherwise you may type range in tiles and flight time in seconds; blank uses the matched projectile's values. Speed is calculated from range and time and is never shown or exported.

A bomb tag matches the first attack in its phase that fires its sprite, whatever its pattern family, and otherwise the first attack firing it in any phase; the status names a phase it borrowed from. When the attack's family differs from the tag's, only the projectile and emitter radius are borrowed and the pattern is built from the tag, with neutral defaults (a ring's phase and rate 0, a spread's arc 0). A scatter then needs a typed cone.

## Saved attacks

A **saved attack** is a named set of the sticky attack fields (everything but the phase) plus a typed cadence: shots per burst, shot interval (hidden and absent at one shot per burst) and cooldown after the last shot. Several spans of footage can share one.

1. Set the sticky selection, then press **Save as attack**, type a name and the cadence, and press Save. The new attack is chosen.
2. Record tags while it is chosen and unmodified: they are **linked**. A linked tag stores only its time, phase, attack and burst, so editing the attack changes every tag that uses it. The Tag panel always says whether the next tag will be linked.
3. Changing any control marks the panel *Modified*; recording then makes an unlinked tag until you press **Update from sticky** (overwrites the attack's fields, not its name or cadence) or **Save as attack** again. The number keys count as changing a control.
4. Choosing an attack in the **Saved attack** dropdown copies its values into the controls. **None** unlinks.
5. A linked row shows its attack fields read-only (its Attack column names it). **Detach** copies the values onto the tag and unlinks it. You cannot link an existing tag later.
6. **Rename** any time; tags stay linked and later exports use the new name. **Delete saved attack** is refused while any tag uses it.

Summary and Tags both have an Attack column.

## Repeats

A repeat is one linked row with an end time. Press **End repeat here** (there is no key) to store the presented frame's time on the selected linked row, or on the latest linked row of the chosen attack before the current frame. The end must be after the row's time. Or type a time in the row's **Repeat end** field; that value carries a permanent `typed` mark until you recapture it with the button. Clearing the field removes the repeat. A repeat row has no burst number, and the burst and repeat fields exclude each other; a repeat row cannot be detached until its end is cleared.

The preview expands the row into volleys on the saved attack's cadence: volley `k` fires at `start + floor(k / shotsPerBurst) * ((shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds) + (k mod shotsPerBurst) * shotIntervalSeconds`, while that time is at or before the end. Each volley gets a timeline marker and counts for `[` and `]`, but generated volleys are never observations: the Summary counts a repeat once, at its first volley, and typed cadence is not a measurement.

**Rotation clock.** For linked rings, one clock runs per saved attack and phase, starting at its earliest volley and turning through the gaps between rows, so arm 0 of a volley is the phase plus the rate times the time since that start. Unlinked tags keep the per-group rule above. A nonzero **emitter radius** makes each volley fire from a different point as the arms turn.

## Tuning in the preview

Select a tag row and the preview panel shows a **Tuning** section for it. It edits only the study's typed estimates, never game data. A linked row tunes its saved attack ("Tuning saved attack ...: N tags"), so every tag using it follows; an unlinked row tunes only itself. The values are rotation rate (with a slider of ±720 degrees per second; a typed number may exceed it), initial phase and emitter radius where they apply, and on a linked row shots per burst, shot interval and cooldown. Pausing mid-pattern and dragging the rate redraws the frozen frame. Raising shots per burst from one fills in a starting interval of 0.1 s, an input convenience you should retype.

## Exporting a saved attack

A linked row's export uses the saved attack's name as a slug (lowercase letters, digits and hyphens; a name of only symbols falls back to the attack's stable id) plus `-tagged` for the attack id and any projectile variant. Its `shotsPerBurst`, `cooldownAfterLastShotSeconds` and, above one shot, `shotIntervalSeconds` are the typed cadence; the rest comes from the match. The cadence is typed, not measured, and the phase is at its first volley.

When you typed a bomb range or time, or a `linear` bullet's speed or range, the export box also shows a second **Projectile JSON** box: paste it under `projectiles` in `projectiles.json`, beside the attack that references it. Nothing is written for you.

### Worked example: a ring repeating every 0.4 seconds

1. Choose the ring's sprite and phase, pattern `rotating-arm`, arms 8; type a rotation rate of 30 and a phase of 0.
2. Press **Save as attack**, name it `Slow spiral`, shots per burst 1, cooldown 0.4, and Save.
3. Seek to the first volley and press Enter: a linked row appears.
4. Seek to the last volley of the sweep and press **End repeat here**; the row now has a repeat end and the timeline shows a marker per 0.4 s.
5. Select the row. In Tuning, drag the rotation rate while the preview is paused mid-pattern until the arms line up with the video; type an emitter radius if each volley fires from a different point.
6. Open **Export as attack**: the attack id is `slow-spiral-tagged`, with your typed cooldown and rate. Paste it by hand into the monster's file under `app/src/game/data/enemies/`.

## Correcting a monster from video

The **Monster draft** panel lets you correct a monster's attacks against a recording and copy the result back as that monster's data file. Nothing is written to disk.

1. Choose the **Encounter**, then the **Monster**. Every monster the encounter can reach is listed, including a spawn's own spawns. Each monster has its own study, even on one video. Switching monster keeps the video and its time, saves the current study, and opens the other monster's saved study for this video, or an empty one. Every monster's study has tags, saved attacks and the **Draft** and **Tags** switch, and a tag's phase, match, preview and export follow the selected monster's own phases.
2. Choose a **Phase** in the draft panel. It is the same value as the Tag panel's **Phase** select, so changing either changes both, and it is saved with the study and restored when you reopen it. The panel lists only the selected phase's blocks, anchors and attack lists, and changing phase clears the selected attack. Press **Load from game**. With no draft it copies the whole monster. Once a draft exists, loading again asks first, names the phase, replaces only the selected phase's attacks, keeps every other phase's edits and all your anchors, and names any anchor whose block no longer exists.
3. Find the first frame of a block in the video and press **Starts here** on that block. It records the presented frame's time, and pressing it again moves it. **Clear** removes it. A block with no anchor draws nothing. A press is refused while a seek is pending.
4. A **block** is a phase with no sub-phases, or one sub-phase. Sub-phases are separate blocks with their own anchors: nothing cycles them for you. A block runs the phase's attacks plus its own sub-phase's attacks. The anchor means the moment the block is entered, and the preview adds the block's telegraph, as the game does.
5. The draft preview draws only the selected phase's blocks, but an anchor in any phase still ends the block before it, so a block with no authored duration stops at the next phase's anchor. The preview stops a block at the earliest of its authored duration, the monster's next anchor, and the end of the video. Shots already fired finish their flight. Anchors at the same time resolve in authored order, and the later block wins.
6. Select an attack to edit its projectile, pattern kind and fields, aim, target, and the four cadence values including **Initial delay**. An edit the game's validators refuse changes nothing and shows their message. Changing the pattern kind removes fields that no longer apply and names them. **Add attack** starts from a single player-aimed shot, which is a starting point and not a game value. **Delete** asks first. Editing or adding an attack sets its source to `video-observation`.
7. The export box shows the monster's whole file, built from its current file with only the selected phase's attack lists replaced, so hand edits to phase values and every other phase survive, even when the draft holds edits there. It refuses only when the selected phase, or one of its sub-phases, is in the draft or the file but not both. Edit and export one phase at a time. Press **Copy file** and paste it over the path shown.
8. A small **?** sits beside every control in the draft panel and beside every other section's heading. Hover it to read what the control does; the text is its tooltip and has no keyboard popup.

Limits, plainly: the preview uses one fixed emitter and draws only the selected monster, so a chasing monster stays still and a nest fires from the emitter. Scatter uses even spacing. The Worm's shard has no sprite, so its attacks can be edited and exported but not seen. Per-burst advance, gap sectors and arm spread are shown read-only and survive export, but have no controls. Phase and monster values and the projectile catalog are changed by hand. Anchors never reach the game. Pasting a file changes gameplay, so its `rulesVersion` bump and test updates are a separate approved change.

The **Draft** and **Tags** switch above the preview chooses which one is drawn; it is view state and is not saved.

### Worked example: moving one attack's first shot

1. Open the Queen study, press **Load from game**, and press **Starts here** on the frame the block is entered in the video, before its telegraph begins. The anchor marks the block's entry, never an attack's first shot.
2. Select an attack in that block and note when its first shot appears in the video compared with the preview.
3. Change **Initial delay (s)** by the difference, then step the video to confirm the first volley now lines up.
4. Copy the file from the export box and paste it over `app/src/game/data/enemies/killer-bee-queen.json`. Applying it is a separate approved change.

## Good practice

- Tag the first frame where the projectile is visible, and be consistent about it.
- Tag every volley of a burst, not just the first, so the within-burst interval can be measured.
- Use **Go to** to spot-check a few tags before exporting.
- Keep the video file name stable, because the autosave slot is keyed by it.
