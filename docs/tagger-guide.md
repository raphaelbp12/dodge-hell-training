# Tagger Guide

The tagger is a development-only tool for recording when and how a boss fires shots in a gameplay video. Its output is an observation file that later plans cite as evidence. It never uploads the video and never changes the game.

## Open it

Run `npm run dev` from `app/` and open the dev URL with `?tagger=1`, for example `http://localhost:5173/?tagger=1`.

## Terms

- **Volley:** one firing, where all of its projectiles leave together. Each volley is one tag.
- **Burst:** several volleys close together, followed by a pause.
- **Pattern:** where the shots go. Choose `rotating-arm`, `fixed-ring`, `spread` or `scatter`. A loaded legacy tag may show `volley`, which cannot be chosen for new tags.
- **Aim:** `player` or `fixed`. It exists only on `spread` and `scatter`.
- **Shots / arms:** the number of projectiles in the volley, or the number of arms for a ring or rotating arm.

## First session

1. Choose the local video file. It stays on your machine.
2. Type the video's **presented frame rate** (for example 30). There is no default. Check it against the real video, because frame stepping uses it and the export records it. Recording, frame stepping and export are all blocked until it is set.
3. Optionally type the public source URL. Leave it blank for a local-only recording.
4. Pick the encounter. Changing the encounter later clears the tags.

## Tagging

Seek to the exact frame where a volley first appears. Set the sticky selection (sprite, phase, pattern, aim if shown, shots), then record. The recorded time is the presented frame's time, not the seek target, so after any seek wait for the frame to appear.

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

For a burst, press **B** on its first volley, then **Shift + Enter** on each further volley. A continuation attaches to the highest burst id with the same phase, sprite, pattern and aim. If none exists, the tool shows an error and records nothing. To tag two interleaved bursts, change the sticky selection between them.

The readout beside the record button shows the interval since the previous tag in the current group. The Summary panel shows the whole study. A group with bursts reports `between-bursts` intervals (start to start) and `within-bursts` intervals separately. A group without bursts reports one `all` result. The tool derives no cadence values; mapping them to game tuning is a separate decision.

## Correcting mistakes

The Tags list shows the newest footage first. Every field in a row can be edited in place. A rejected value (for example a time outside the video, or a non-integer burst) shows an error and leaves the tag unchanged.

- Editing a time marks the tag `typed`, and the mark never clears. Delete and re-record the tag to get a frame-derived time back.
- Clearing the Burst field removes the burst id.
- **Go to** seeks the video to that tag's time.
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

The preview shows your tags played with the game's current geometry, not geometry measured from the footage. Each tag borrows its speed, motion, range, pattern shape and emitter offset from the matching authored attack: the first attack in the tag's phase that fires the tag's sprite in the same pattern family. Rings do not rotate, and scatter shots are spread evenly across the cone instead of randomly.

A tag with no matching attack, an unknown sprite or phase, or the `volley` pattern is not drawn. The panel shows "N tags not previewed" under the canvas when any such tag exists.

- **Player sliders.** The x and y sliders place the player point, which player-aimed spread and scatter volleys aim at. It starts at the encounter's player spawn and resets when you reload or change the encounter.
- **Zoom and pan.** The mouse wheel over the canvas zooms 1×, 2× and 4× about the cursor, dragging pans within the arena, and Reset view returns to the fitted view.
- **Size and visibility.** Hide preview collapses the panel; Small, Medium and Large set a 320, 480 or 720 pixel square. Only visibility and size are remembered across reloads.
- **Burst highlight.** Clicking a tag row seeks the video and outlines every volley of that tag's burst, or just that tag when it has no burst. The outline stays while you scrub; click another row to move it, or the same row to clear it.

Without an open video the canvas is black with a note asking you to open one.

## Good practice

- Tag the first frame where the projectile is visible, and be consistent about it.
- Tag every volley of a burst, not just the first, so the within-burst interval can be measured.
- Use **Go to** to spot-check a few tags before exporting.
- Keep the video file name stable, because the autosave slot is keyed by it.
