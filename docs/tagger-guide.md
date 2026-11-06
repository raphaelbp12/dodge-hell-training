# Tagger Guide

The tagger is a development-only tool for recording when and how a boss fires shots in a gameplay video. Its output is an observation file that later plans cite as evidence. It never uploads the video and never changes the game.

## Open it

Run `npm run dev` from `app/` and open the dev URL with `?tagger=1`, for example `http://localhost:5173/?tagger=1`.

## Terms

- **Volley:** one firing, where all of its projectiles leave together. Each volley is one tag.
- **Burst:** several volleys close together, followed by a pause.
- **Pattern:** where the shots go. Choose `rotating-arm`, `fixed-ring`, `spread` or `scatter`. A loaded legacy tag may show `volley`, which cannot be chosen for new tags.
- **Aim:** `player`, `fixed` or `front`. It exists only on `spread` and `scatter`. `front` means the shot is aimed relative to the enemy's front (its movement heading); the tag records only that, never an angle.
- **Shots / arms:** the number of projectiles in the volley, or the number of arms for a ring or rotating arm.
- **Arm pattern:** what each arm of a ring fires: a single shot (the default), a `spread`, a `scatter`, or another `ring`. Only `rotating-arm` and `fixed-ring` tags have one, and a tag describes one level only; deeper nesting is authored in `enemies.json`.
- **Shots per arm:** how many shots each arm fires (for an inner ring, how many inner arms).
- **Typed estimates:** the cone width of a spread or scatter arm, and a rotating arm's clockwise degrees per second and initial phase, are numbers *you type*. They are estimates, not measurements from the video, and the preview and export treat them as such. A blank rotation field means "use the matched attack's authored value".

## First session

1. Choose the local video file. It stays on your machine.
2. Type the video's **presented frame rate** (for example 30). There is no default. Check it against the real video, because frame stepping uses it and the export records it. Recording, frame stepping and export are all blocked until it is set.
3. Optionally type the public source URL. Leave it blank for a local-only recording.
4. Pick the encounter. Changing the encounter later clears the tags.

## Tagging

Seek to the exact frame where a volley first appears. Set the sticky selection (sprite, phase, pattern, aim if shown, shots, and for a ring the arm pattern with its shots per arm, cone width, rotation rate and phase), then record. Changing the pattern keeps your arm and rotation choices, but a new tag only takes the ones its pattern allows. A ring tag gets its arm pattern only when shots per arm (and a cone width for spread or scatter) are set. The recorded time is the presented frame's time, not the seek target, so after any seek wait for the frame to appear.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left / Right | Step one frame |
| Shift + Left / Right | Jump 5 seconds |
| PageUp / PageDown | Jump 30 seconds |
| Enter | Record a standalone tag |
| B | Record a volley and start a new burst |
| Shift + Enter | Record a volley and add it to the latest matching burst |
| 1 to 9 | Set the shot count |

Holding a record key does not repeat. Keys are ignored while a text, number or select field is focused.

### Standalone tags and bursts

Use **Enter** for a shot that is not part of a burst.

For a burst, press **B** on its first volley, then **Shift + Enter** on each further volley. A continuation attaches to the highest burst id with the same phase, sprite, pattern, aim and arm pattern. If none exists, the tool shows an error and records nothing. To tag two interleaved bursts, change the sticky selection between them.

The readout beside the record button shows the interval since the previous tag in the current group. The Summary panel shows the whole study. A group with bursts reports `between-bursts` intervals (start to start) and `within-bursts` intervals separately. A group without bursts reports one `all` result. The tool derives no cadence values; mapping them to game tuning is a separate decision.

## Correcting mistakes

The Tags list shows the newest footage first. Every field in a row can be edited in place. A rejected value (for example a time outside the video, or a non-integer burst) shows an error and leaves the tag unchanged.

- Editing a time marks the tag `typed`, and the mark never clears. Delete and re-record the tag to get a frame-derived time back.
- Clearing the Burst field removes the burst id.
- A ring row has a **Geometry (typed)** cell: choose its arm pattern (a spread or scatter arm asks for a cone width), shots per arm, and for a rotating arm its rate and phase. Clearing a rotation field removes the typed value. Changing a tag's pattern drops the fields the new pattern cannot have.
- **Go to** seeks the video to that tag's time.
- **Export as attack** shows the tag as an attack you can paste into `enemies.json` (see below).
- **Delete** removes a row. There is no undo.

## Saving and resuming

Work is saved to browser storage automatically after the first tag or edit, with one slot per video file name. Reopening the tagger lists saved sessions with restore and discard. Nothing is removed unless you discard it. A failed save shows an autosave error and tagging continues, so export if you see one.

To continue from an exported file, use **Load study**. Loading replaces the current tags after you confirm. Then choose the video; the first video chosen after a load keeps the tags. A mismatch between the study's file name and the chosen video only warns, and the next export uses the open video's file name and duration.

Without a video you can still load, edit and export a study, but you cannot record, step or seek.

A v1 file (from the first pilot) loads with a blank frame rate. Enter the presented rate before exporting.

## Exporting

Press **Export JSON**. The file is `<encounter-id>-observations.json`, schema version 2, tags sorted by time. Move it into `docs/` by hand if it is evidence. Do not edit committed evidence files; load them, correct them and export a new version instead.

## Preview

A square preview sits to the right of the video. It follows the presented video frame, so play, pause, frame steps, jumps and seeks all move it with no extra controls. While a seek is pending it keeps showing the previous presented frame.

The preview shows your tags played with the game's current geometry, not geometry measured from the footage. Each tag borrows its speed, motion, range and emitter offset from the matching authored attack: the first attack in the tag's phase that fires the tag's sprite in the same pattern family. A composite tag therefore matches a plain ring. The tag's own geometry wins: its arms, arm pattern, shots per arm, cone width, aim and typed rotation replace the attack's, and a tag with no arm pattern draws single-shot arms even when the authored attack is a composite. Scatter shots are spread evenly across the cone instead of randomly.

**Rotation.** A `rotating-arm` tag's arm 0 points at its phase plus its rate times the time since the *first tag of its group* (same phase, sprite, pattern, aim and arm pattern). Each of rate and phase is the value you typed on that tag, otherwise the matched attack's authored value, so existing tags now rotate at the authored rate. The first tag of a group fires on its phase. A `fixed-ring` tag never rotates, even on a rotating attack; it only chooses where each volley fires. Per-burst advance and arm spread are not drawn: an advancing attack shows every burst at the same angle unless you type a different phase on that tag.

A tag with no matching attack, an unknown sprite or phase, or the `volley` pattern is not drawn. The panel shows "N tags not previewed" under the canvas when any such tag exists.

- **Player sliders.** The x and y sliders place the player point, which player-aimed spread and scatter volleys aim at. It starts at the encounter's player spawn and resets when you reload or change the encounter. A *targeted bomb* (an attack that throws a bomb at the player) lands on this point, because the game captures the player's position when it fires and the preview has no recorded position; with more than one shot the tag's count wins and the bomb lands at its authored range instead.
- **Enemy heading slider.** Sets the direction the enemy faces, in degrees from 0 to 360, and shows it as an arrow on the emitter. It turns *only* `front`-aimed shots: rings and `fixed` shots stay absolute, as they are in the game. There is one value for the whole study; it starts at the archetype's initial heading (or 0) and resets on reload.
- **Zoom and pan.** The mouse wheel over the canvas zooms 1×, 2× and 4× about the cursor, dragging pans within the arena, and Reset view returns to the fitted view.
- **Size and visibility.** Hide preview collapses the panel; Small, Medium and Large set a 320, 480 or 720 pixel square. Only visibility and size are remembered across reloads.
- **Burst highlight.** Clicking a tag row seeks the video and outlines every volley of that tag's burst, or just that tag when it has no burst. The outline stays while you scrub; click another row to move it, or the same row to clear it.

Without an open video the canvas is black with a note asking you to open one.

## Exporting a tag as an attack

Click **Export as attack** on a row to show that tag as the JSON of an authored attack, in a read-only box with a **Copy JSON** button. If the browser blocks copying, select the text by hand. Nothing is ever written to a file: paste the JSON into the right archetype's `attacks` in `enemies.json` yourself.

The exported attack is exactly what the preview draws for the tag: the arms, arm pattern, typed cone, aim and rotation, with the pattern's phase written back as `initialPhaseDegrees`. Because the phase is measured at the *first tag of the group* rather than the game's clock start, adjust it if the attack's clock starts elsewhere. The id is the matched attack's id plus `-tagged`; the projectile and cadence are copied from the matched attack (the tool never derives cadence from your tagged intervals); and `tuningSource` is `video-observation`. A tag with no matching attack cannot export. A `front`-aimed export carries a note: its archetype also needs `initialHeadingDegrees`.

To tag, preview and export a ring of spreads: choose a `rotating-arm` or `fixed-ring` pattern, set the arm count, choose arm pattern `spread`, set shots per arm and a cone width, record, check the preview, then select the row's **Export as attack**.

## Good practice

- Tag the first frame where the projectile is visible, and be consistent about it.
- Tag every volley of a burst, not just the first, so the within-burst interval can be measured.
- Use **Go to** to spot-check a few tags before exporting.
- Keep the video file name stable, because the autosave slot is keyed by it.
