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
      "Enter its presented frame rate in frames per second. If you do not know it, leave it blank: playing the video fills it in.",
      "Choose the encounter and the monster. One study covers one monster.",
      "Pick the phase at the top of the page. New tags and the monster draft use only that phase.",
      "To continue earlier work, restore a saved session or load a study JSON you exported before.",
      "Press Start tagging.",
    ],
    tips: [
      "A session saves automatically, per video file name, once you record a tag or edit the draft.",
      "Choosing a different video asks before it clears the tags in this session. Saved sessions are not affected.",
      "Keyboard shortcuts are off on this step, so typing in the fields is safe.",
    ],
  },
  tag: {
    name: "Tag volleys",
    purpose:
      "Record one tag for each volley you see, at the frame where its shots first appear.",
    actions: [
      "Play or scrub to just before a volley, then step frame by frame with the arrow keys to the frame where its shots appear.",
      "On the right, describe the volley: its sprite, pattern, aim and shot or arm count.",
      "Check the dot under Next tag. Green means the tag will play in the preview; amber says why it will not.",
      "Press Record tag or Enter.",
      "For several volleys close together, press B on the first to start a burst and Shift+Enter on each later one.",
      "For an attack that repeats, save it as a saved attack, record its first volley linked to it, then go to its last volley and press End repeat here.",
    ],
    tips: [
      "The settings stay after each tag, so a run of the same volley needs only Enter.",
      "Number keys 1 to 9 set the shot count; [ and ] jump between recorded volleys, shown as amber marks on the timeline.",
      "Typed estimates are numbers you judge by eye. Leave them blank to keep the matched attack's values.",
      "After a jump, recording waits until the new frame is on screen.",
    ],
  },
  review: {
    name: "Review tags",
    purpose: "Check the recorded tags, fix mistakes, and export what you found.",
    actions: [
      "Read the Tags table, newest footage first. Click a row to jump the video there and highlight its shots in the preview.",
      "Edit a cell to fix a time, sprite, phase, pattern or count. Edits apply at once and cannot be undone.",
      "With a row selected, tune its typed estimates under the preview while you watch the shots.",
      "Use the Summary to compare the intervals between volleys of the same kind.",
      "Press Export as attack on a row for attack JSON to paste by hand, or Export study JSON at the top to save the whole study.",
    ],
    tips: [
      "Use these settings copies a row back into Next tag, ready to record more like it.",
      "A row linked to a saved attack has its attack fields locked. Detach it to edit them.",
      "The Preview column says whether each tag plays in the preview, and as which attack.",
    ],
  },
  draft: {
    name: "Draft monster",
    purpose:
      "Edit a copy of this monster's attacks for the selected phase, line it up with the video, and copy the file to paste by hand.",
    actions: [
      "Press Load from game to copy the game's current attacks into a draft.",
      "For each block, pause on the frame where it is entered, before its telegraph, and press Starts here.",
      "Choose an attack to open its editor, and change its projectile, pattern or cadence. Add or delete attacks as needed.",
      "Play the video with the preview set to Draft to compare the draft with the footage.",
      "Press Copy file and paste the text over the monster's file yourself.",
    ],
    tips: [
      "The draft and its anchors save with the session. The game never reads them.",
      "Loading again replaces only the selected phase's attacks and keeps your anchors.",
      "Pasting the file changes gameplay, so the rules version bump and the test updates are a separate approved change.",
      "Anchors are never written into the file.",
    ],
  },
};
