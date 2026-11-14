import type { TaggerStep } from "./TaggerControls";

/**
 * What each tagger step is for and what to do in it, shown by the Step guide
 * button. Each sentence describes the tagger itself and makes no claim about
 * the game being recreated. Pure data, so the step bar and the guide share
 * the step names.
 */
export type StepGuide = Readonly<{
  name: string;
  /** One sentence: what this step produces. */
  purpose: string;
  /** What to do, in order. */
  actions: readonly string[];
  /** Things worth knowing that are not steps. */
  tips: readonly string[];
}>;

export const STEP_GUIDES: Readonly<Record<TaggerStep, StepGuide>> = {
  setup: {
    name: "Set up",
    purpose:
      "Open the footage and say which monster this study is about. The video stays in this browser and is never uploaded.",
    actions: [
      "Choose the video file you want to study.",
      "Enter its presented frame rate in frames per second, or leave it blank and press Play: playback detects it.",
      "Choose the encounter and the monster. One study covers one monster, and its attacks load as attack tracks automatically.",
      "To continue earlier work, restore a saved session or load a study JSON you exported before.",
      "Press Start the structure.",
    ],
    tips: [
      "A study autosaves per video file and monster once it holds a mark or a boundary.",
      "Choosing a different video asks before it clears the marks in this study. Saved sessions are not affected.",
      "Keyboard shortcuts are off on this step, so typing in the fields is safe.",
    ],
  },
  structure: {
    name: "Structure",
    purpose:
      "Mark where each segment is entered, where its telegraph ends, and where the monster is invulnerable.",
    actions: [
      "Play to the frame where a segment is entered and press Segment starts here or S.",
      "If the guessed segment is wrong, fix it in the boundary table.",
      "Press Telegraph ends here or T on the frame where the warning ends.",
      "Press Invulnerable starts here or I where an invulnerable stretch begins, and Invulnerable ends here or I again where it stops.",
    ],
    tips: [
      "The same segment can be entered many times; mark each entry as it happens.",
      "Each boundary's window runs to the next boundary or the video end, and every later mark takes its segment from it.",
      "Click a boundary's time to go back to its frame.",
    ],
  },
  attacks: {
    name: "Attacks",
    purpose: "Mark every volley on its attack track, and read the fit of its cadence.",
    actions: [
      "Select an attack track with its number key, 1 to 9, or by clicking its timeline row.",
      "Mark every volley with Enter at the frame where its projectiles appear.",
      "Mark where the attack visibly stops with X.",
      "Read the fit and accept the measured cadence you trust.",
      "Use the scratch track, key 0, for any volley you cannot yet name.",
    ],
    tips: [
      "Delete or Backspace removes the mark on the selected track at the presented frame.",
      "[ and ] jump between marks.",
    ],
  },
  reconcile: {
    name: "Reconcile",
    purpose: "Compare what was measured with what is authored, and copy the monster file.",
    actions: [
      "Read the warnings.",
      "Accept the measured values you trust.",
      "Copy the monster file and paste it over the file yourself.",
    ],
    tips: [
      "Pasting the monster file changes gameplay, so applying it is a separate approved change.",
    ],
  },
};
