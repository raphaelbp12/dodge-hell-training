/**
 * The tagger's own vocabulary, shown in its Glossary panel. Each entry
 * describes how the tagger uses the word, drawn from the tagger guide, and
 * makes no claim about the game being recreated. Pure data.
 */
export type GlossaryEntry = Readonly<{ term: string; meaning: string }>;

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: "Telegraph", meaning: "The warning time at the start of a phase or sub-phase, before its attacks begin firing. The draft preview starts a block's attack timing at its anchor plus its telegraph." },
  { term: "Phase", meaning: "A stage of a monster's fight. A monster's attacks are authored per phase. The study has one selected phase, shared by the Tag panel and the Monster draft panel." },
  { term: "Sub-phase", meaning: "A part of a phase with its own telegraph and attacks. It runs the phase's attacks plus its own." },
  { term: "Block", meaning: "A phase with no sub-phases, or one sub-phase. Each block has its own anchor." },
  { term: "Anchor", meaning: "The video time at which a block is entered, set with Starts here. It marks the block's entry, before its telegraph, never an attack's first shot. It aligns a draft with a video and is never exported." },
  { term: "Monster draft", meaning: "A working copy of one monster's attacks, loaded from the game and edited in the tagger. The game never reads it." },
  { term: "Study", meaning: "Everything recorded for one monster on one video: tags, saved attacks, the draft and the selected phase. It autosaves per video and monster." },
  { term: "Tag", meaning: "One time-stamped observation of a volley at the presented video frame." },
  { term: "Volley", meaning: "One firing, where all of its projectiles leave together. Each volley is one tag." },
  { term: "Burst", meaning: "Several volleys close together, followed by a pause." },
  { term: "Cadence", meaning: "An attack's timing: shots per burst, shot interval, cooldown after the last shot, and initial delay." },
  { term: "Initial delay", meaning: "Seconds after a block's telegraph ends before the attack's first burst." },
  { term: "Cooldown", meaning: "Seconds from a burst's last volley to the start of the next burst." },
  { term: "Pattern", meaning: "Where the shots go: rotating-arm, fixed-ring, spread or scatter in tags; ring, spread or scatter in the draft." },
  { term: "Aim", meaning: "What a spread or scatter points at: the player, the monster's front, or a fixed bearing." },
  { term: "Arm", meaning: "One spoke of a ring or rotating arm. An arm may fire a single shot or a small pattern of its own (arm pattern)." },
  { term: "Emitter", meaning: "The fixed point the preview fires from. It does not move, even for a monster that chases." },
  { term: "Bomb", meaning: "A projectile that flies for a set time, then detonates. It hits only by detonating." },
  { term: "Typed estimate", meaning: "A number you type, such as a cone width or bearing. It is an estimate, not a measurement from the video." },
  { term: "Saved attack", meaning: "A named, reusable set of tag fields and cadence that tags can link to and repeat." },
  { term: "Repeat", meaning: "A tag that stands for a saved attack's volleys over time until its end time." },
  { term: "Match status", meaning: "Which authored attack a tag plays as in the preview, or why it will not preview." },
  { term: "Presented frame", meaning: "The video frame currently shown. Every time in the tagger comes from the video's own clock." },
];
