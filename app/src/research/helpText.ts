/**
 * Hover help for the dev-only tagger (plan V19 J11-J13). Each text is a plain
 * sentence about what the tagger itself does, drawn from the tagger guide. No
 * text makes a claim about the game being recreated. Pure: no React, DOM or
 * storage, so the panels and their tests share the same constants.
 */

// ---- Monster draft panel ---------------------------------------------------

export const HELP_DRAFT_HEADING =
  "A working copy of the selected monster's attacks that you edit here and export as text. Nothing is written to the game files.";
export const HELP_DRAFT_PHASE =
  "The phase this study works on. New tags record it, and the monster draft, its preview, Load from game and the export all use only this phase.";
export const HELP_DRAFT_LOAD =
  "Copies the game's current attacks into the draft. With no draft yet it copies the whole monster; with one it replaces only the selected phase's attacks and keeps your anchors.";
export const HELP_DRAFT_BLOCK =
  "A block is a phase, or one sub-phase of it. The line shows the block's telegraph and its authored duration, which are read-only here.";
export const HELP_STARTS_HERE =
  "Records the video frame now shown as the moment this block is entered, before its telegraph. It marks the block's entry, not the first shot of any attack.";
export const HELP_CLEAR_ANCHOR =
  "Removes this block's recorded entry time. The block then draws nothing in the draft preview.";
export const HELP_NEW_ATTACK_ID =
  "The id for a new attack in this list. It must be unique among the monster's attacks.";
export const HELP_ADD_ATTACK =
  "Adds a new attack with the new id to this list, starting as a single player-aimed shot to edit.";
export const HELP_ATTACK_LIST =
  "The attacks in this list. Choose one to edit its projectile, pattern and cadence below.";
export const HELP_ATTACK_PROJECTILE =
  "The projectile this attack fires. Its sprite and motion come from the game's projectile catalog.";
export const HELP_ATTACK_KIND =
  "The shape of the pattern: a ring of arms, a spread across an arc, or a scatter inside a cone. Fields that do not apply to the new shape are removed and reported.";
export const HELP_RING_ARMS = "How many arms the ring has, evenly spaced around the emitter.";
export const HELP_RING_INITIAL_PHASE = "The angle in degrees the first arm points at when the block's telegraph ends.";
export const HELP_RING_RATE = "How fast the ring turns, in degrees per second. A negative value turns it the other way.";
export const HELP_ARM_PATTERN = "What each arm fires: a single shot, or a small spread, scatter or ring of its own.";
export const HELP_ARM_ARMS = "How many arms each arm's own ring has.";
export const HELP_ARM_SHOTS = "How many shots each arm fires.";
export const HELP_ARM_ARC = "The arc in degrees each arm's spread covers.";
export const HELP_ARM_CONE = "The cone width in degrees each arm's scatter covers.";
export const HELP_PATTERN_SHOTS = "How many shots one volley fires.";
export const HELP_PATTERN_ARC = "The arc in degrees a spread covers, centred on its aim.";
export const HELP_PATTERN_CONE = "The cone width in degrees a scatter covers, centred on its aim.";
export const HELP_PATTERN_AIM =
  "What the volley points at: the player, the monster's front, or a fixed bearing you type.";
export const HELP_PATTERN_OFFSET = "Degrees the volley is turned away from the monster's front.";
export const HELP_PATTERN_BEARING = "The fixed bearing in degrees the volley points at.";
export const HELP_EMITTER_RADIUS = "How far from the monster's centre, in tiles, the shots start.";
export const HELP_TARGET_PLAYER =
  "Makes a bomb land on the player's position when it is thrown. It does nothing for ordinary bullets.";
export const HELP_SHOTS_PER_BURST = "How many volleys one burst fires before the cooldown.";
export const HELP_SHOT_INTERVAL = "Seconds between the volleys inside one burst.";
export const HELP_COOLDOWN = "Seconds from a burst's last volley to the start of the next burst.";
export const HELP_INITIAL_DELAY = "Seconds after the block's telegraph ends before the first burst.";
export const HELP_READ_ONLY_FIELDS =
  "Pattern fields this editor cannot change. They are kept unchanged in the export.";
export const HELP_DELETE_ATTACK = "Deletes the selected attack from this list after a second click to confirm.";
export const HELP_EXPORT_BOX =
  "The monster's whole file text with only the selected phase's attacks replaced from the draft. Paste it over the file by hand; the tagger writes nothing.";
export const HELP_COPY_FILE = "Copies the file text to the clipboard, or tells you to copy it by hand.";

// ---- Other tagger sections -------------------------------------------------

export const HELP_SECTION_SESSIONS =
  "Studies this browser autosaved, one per video file and monster. Restoring one replaces the tags in the current session.";
export const HELP_SECTION_VIDEO =
  "Choose a local video and enter its presented frame rate. Nothing is uploaded; all times come from the video's own clock.";
export const HELP_SECTION_TAG =
  "Records a tag at the frame now shown: its phase, pattern, aim and shot count. A tag is an observation, not a game value.";
export const HELP_SECTION_SPRITE = "Chooses the projectile sprite the next tag records.";
export const HELP_SECTION_SUMMARY =
  "Counts the tags by phase and pattern, and shows the intervals between them measured from the video.";
export const HELP_SECTION_TAGS =
  "Every recorded tag in time order. Select a row to highlight its shots in the preview, edit it, or export it as an attack.";
export const HELP_SECTION_PREVIEW =
  "Draws the tagged volleys, or the draft, at the video's current time over a fixed emitter and a player you can move.";
