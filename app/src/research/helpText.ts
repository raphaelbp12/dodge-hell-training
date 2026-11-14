/**
 * Hover help for the dev-only tagger (plan V19 J11-J13). Each text is a plain
 * sentence about what the tagger itself does, drawn from the tagger guide. No
 * text makes a claim about the game being recreated. Pure: no React, DOM or
 * storage, so the panels and their tests share the same constants.
 */

// ---- Monster draft panel ---------------------------------------------------

/** Plan V20 step 87.2. */
export const HELP_CALIBRATE_SCALE =
  "Drag across the monster's body at a frame where it is fully visible. This lets bomb ranges be read in tiles.";
export const HELP_STARTS_HERE =
  "Records the video frame now shown as the moment this segment is entered, before its telegraph. It marks the segment's entry, not the first shot of any attack.";
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
export const HELP_RING_INITIAL_PHASE = "The angle in degrees the first arm points at when the segment's telegraph ends.";
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
export const HELP_INITIAL_DELAY = "Seconds after the segment's telegraph ends before the first burst.";
export const HELP_READ_ONLY_FIELDS =
  "Pattern fields this editor cannot change. They are kept unchanged in the export.";
export const HELP_DELETE_ATTACK = "Deletes the selected attack from this list after a second click to confirm.";

// ---- Other tagger sections -------------------------------------------------

export const HELP_SECTION_SESSIONS =
  "Studies this browser autosaved, one per video file and monster. Restoring one replaces the tags in the current session.";
export const HELP_SECTION_VIDEO =
  "Choose a local video and enter its presented frame rate. Nothing is uploaded; all times come from the video's own clock.";
export const HELP_SECTION_PREVIEW =
  "Draws the tagged volleys, or the draft, at the video's current time over a fixed emitter and a player you can move.";

// ---- Structure step (plan V20 phase 85) -----------------------------------

export const HELP_SEGMENT_STARTS_HERE =
  "Adds a boundary at the presented frame, entering the segment after the previous boundary's segment.";
export const HELP_TELEGRAPH_ENDS_HERE =
  "Marks the presented frame as the end of the telegraph of the latest boundary at or before it.";
export const HELP_INVULNERABLE =
  "Opens an invulnerable span at the presented frame, or closes the open one, on the status track.";
// ---- Reconcile step (plan V20 phase 88) -----------------------------------

export const HELP_RECONCILE_WARNINGS =
  "Checks the study fails, such as a mark outside its segment's window. A warning informs and never blocks the export; choose one with a time to seek there.";
export const HELP_RECONCILE_SEGMENTS =
  "Each segment's measured telegraph, invulnerable time and duration from its boundaries and spans, beside the authored value. Accept a measured value to export it in place of the authored one.";
export const HELP_RECONCILE_ATTACKS =
  "Each attack track's segment, cadence and where its cadence came from. Edit them in the Attacks step.";
export const HELP_COPY_FILE =
  "Copies the monster file text, rewritten from the attack tracks and the accepted values. The tagger writes nothing; paste it over the file yourself.";
export const HELP_PROJECTILE_VARIANT =
  "A copy of a catalog projectile with the accepted flight time or range, to paste into the projectile catalog by hand.";

export const HELP_BOUNDARY_SEGMENT =
  "The segment this boundary enters; change it when the guess is wrong, and every later mark follows.";
