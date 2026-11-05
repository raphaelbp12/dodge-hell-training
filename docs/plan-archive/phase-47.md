# Phase 47: The Preview Panel

> Step prompts and execution records for phase 47 of [plan V14](../plan-v14.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 47.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-47.md` and replace the plan's step lines with one-sentence outcomes.

### Step 47.1 - View Maths

Status: complete. Dependencies: phase 46.

**Implementation prompt**

Create `app/src/research/previewView.ts` with pure helpers over the `PreviewView` and `PreviewZoom` shapes in [plan V14](../plan-v14.md):

- `arenaBoundsTiles(shape)`: the axis-aligned bounding box. For a circle it is the centre plus or minus the radius; for an octagon it is the centre plus or minus `flatHalfWidthTiles`.
- `fitView(shape)`: zoom 1 centred on the bounds' centre.
- `pixelsPerTile(shape, canvasPixels, zoom)`: the scale at which zoom 1 fits the larger bounds side into the canvas, multiplied by the zoom (M27).
- `tileToCanvas` and `canvasToTile` for a view, canvas size and shape.
- `zoomAbout(view, direction, canvasPoint, shape, canvasPixels)`: steps through 1, 2 and 4, stopping at the ends, and keeps the world point under `canvasPoint` fixed (M26).
- `panBy(view, deltaCanvasPixels, shape, canvasPixels)` and `clampView(view, shape, canvasPixels)`: the visible area never leaves the bounds, and at zoom 1 the centre is the bounds' centre (M34).

**Focused checks**

Write failing tests first for: circle and octagon bounds; the fit scale for a square canvas; the tile-to-canvas round trip; zoom stepping up and down and stopping at 1 and 4; the point under the cursor staying fixed when zooming; pan clamping at each edge; and no pan at zoom 1.

**Acceptance**

The helpers are pure and independent of React and the DOM.

### Step 47.2 - Draw The Frame Beside The Video

Status: complete. Dependencies: 47.1.

**Implementation prompt**

Create `app/src/research/previewDraw.ts` with `drawPreviewFrame(context, frame, view, canvasPixels, highlightedTagIndices)` over a `CanvasRenderingContext2D`. Define named colour constants for the background (black), arena outline, emitter, player, highlight ring and note text in this module (M37).

- Draw the arena outline (a circle, or an octagon from `flatHalfWidthTiles` and `cornerSumTiles`), the emitter dot and the player dot (M13).
- Draw each non-bomb projectile from its appearance's pixel grid, converted once per appearance with `appearanceRgbaPixels` into an offscreen canvas and cached, rotated by `orientationRadians` and sized to `visualWidthTiles` by `visualHeightTiles` (M11). Turn off image smoothing.
- Draw a bomb as a filled circle in `bomb.bodyColor` with diameter `visualWidthTiles` (M28), and a detonation as a ring of `radiusTiles` (M12).
- Draw an outline ring around each projectile and detonation whose `tagIndex` is highlighted.

Create `app/src/research/PreviewPanel.tsx` with a CSS module. It takes the tags, `mediaTime`, whether a video is open, the encounter config and the highlighted tag indices. It holds the view and the player point in React state. It redraws the canvas in an effect keyed on those inputs, computing the frame with `previewAt`; it never creates a React element per projectile (M10). Without an open video it draws only the black background and shows a note asking the user to open a video (M15). It shows "N tags not previewed" when `unmatchedTagCount` is above zero (M04).

In `TaggerRoute.tsx`, lay the panel out to the right of the video at a fixed 480 px square for now (phase 48 adds presets), passing the same `mediaTime` the route records tags from (M16, M17).

**Focused checks**

Rendering is checked manually; the logic it depends on is covered by phases 46 and 47.1. If a pure helper is extracted (for example, octagon outline vertices), write its failing test first.

**Acceptance**

Manual check with the pilot video: an empty study shows a black canvas with the arena outline, emitter and player; recording a tag shows its volley at the emitter on that frame; playing moves the projectiles; pausing freezes them; frame steps and jumps move them consistently; a seek shows the new frame once it is presented; and editing or deleting a tag redraws immediately. Without a video, the canvas is black with the note.

### Step 47.3 - Zoom And Pan Input

Status: complete. Dependencies: 47.2.

**Implementation prompt**

In `PreviewPanel.tsx`, wire the mouse wheel over the canvas to `zoomAbout` at the cursor and prevent the page from scrolling while it does. Wire a primary-button drag on the canvas to `panBy`. Add a reset button that restores `fitView` (M26). Zoom and pan are not persisted (M24). The wheel and drag handlers must not trigger the tagger's key map or seek the video.

**Focused checks**

Behaviour is covered by 47.1's tests; input wiring is checked manually.

**Acceptance**

Manual check: the wheel steps 1×, 2× and 4× about the cursor; dragging pans and stops at the arena's edges; there is nothing to pan at 1×; and reset returns to the fitted view.

### Step 47.4 - Player Sliders

Status: complete. Dependencies: 47.2.

**Implementation prompt**

Add two range sliders under the canvas, labelled x and y in tiles. Each spans its axis of `arenaBoundsTiles`, has a step of 0.1 tile and starts at the encounter's `player.spawnTiles` (M08, M23). Moving a slider updates the player point passed to `previewAt`. Changing the encounter resets the point to the new encounter's `player.spawnTiles`. The point is not persisted (M24).

**Focused checks**

If a pure helper builds the slider ranges or the reset rule, write its failing test first: ranges equal the arena bounds, and the default is the player spawn.

**Acceptance**

Manual check: moving the sliders moves the player marker and re-aims player-aimed spread and scatter volleys and player-aimed lob destinations.

### Step 47.5 - Burst Highlight

Status: complete. Dependencies: 47.2.

**Implementation prompt**

Add a pure `highlightedTagIndices(tags, selectedIndex)` to `previewModel.ts`. It returns every index whose tag shares the selected tag's `burstId`, or only the selected index when that tag has none, or nothing when `selectedIndex` is null (M31).

In `TaggerRoute.tsx`, hold the selected tag index. A row click still seeks as Z22 requires, and it also selects that row; clicking the selected row again clears the selection; deleting the selected row clears it; and deleting another row adjusts the stored index so it still names the same tag (M32). Pass the result of `highlightedTagIndices` to the panel. No key clears the highlight.

**Focused checks**

Write failing tests first for `highlightedTagIndices`: no selection; a standalone tag; a burst member returning the whole burst; and a burst id shared across different sprites still highlighting by `burstId` alone. Write a failing test for the index adjustment helper if one is extracted.

**Acceptance**

Manual check: clicking a burst row seeks and outlines every volley of that burst; the outline survives scrubbing; clicking another row moves it; clicking the same row clears it; deleting it clears it. Run `npm run verify` once at the end of the phase.

## Execution record

Added view maths, canvas drawing, `PreviewPanel` with wheel zoom, drag pan, reset, player sliders, and the burst highlight with selection adjustment on delete; wired beside the video in TaggerRoute. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved. Manual checks with a real video are not performed.
