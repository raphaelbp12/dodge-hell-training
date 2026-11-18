import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import { STEP_GUIDES } from "./stepGuide";
import { archetypeOf } from "../game/config/encounter";
import { segmentsOfMonster, type StudyV5 } from "./study";
import { emptyStudy } from "./studyMigrate";
import { monsterFileTextFromStudy } from "./studyExport";
import { TaggerRoute } from "./TaggerRoute";
import { buildDraft, TaggerSessions, type SessionDraft } from "./taggerSessions";

/**
 * Plan V22 A22: four flows through the route's public behaviour. The route
 * reads `window.localStorage`, so a saved session is written there; jsdom has
 * no media pipeline, so the video element's playback methods are faked and no
 * video is chosen (a restored study needs none).
 */

// The Killer Bee Queen's catalog is the only one that can export every shipped monster.
const config = encounterConfigOf("killer-bee-queen");
const base = emptyStudy({
  encounterId: "killer-bee-queen",
  archetypeId: config.primaryArchetypeId,
  provenance: { sourceUrl: null, fileName: "queen-flow.mp4", frameRate: 30, durationSeconds: 120 },
  recordedAt: "2026-11-16T00:00:00.000Z",
  rawFile: AUTHORED_MONSTER_FILES[config.primaryArchetypeId],
});
const firstTrack = base.tracks[0];
const study: StudyV5 = {
  ...base,
  boundaries: [{ timeSeconds: 3, segmentId: segmentsOfMonster(archetypeOf(config, config.primaryArchetypeId))[0].id, telegraphEndSeconds: 3.5 }],
  tracks: base.tracks.map((track, index) =>
    index === 0
      ? { ...track, marks: [5, 6.5, 8].map((timeSeconds) => ({ timeSeconds, kind: "volley" as const })) }
      : track,
  ),
};
const draft: SessionDraft = buildDraft({ study, selectedTrackId: null, savedAt: "2026-11-16T01:00:00.000Z" });

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const sessions = new TaggerSessions(() => window.localStorage);
  const written = sessions.write(draft, config.primaryArchetypeId);
  if (!written.ok) throw new Error(written.error);
});

async function restoreStudy(user: ReturnType<typeof userEvent.setup>) {
  render(<TaggerRoute />);
  await user.click(await screen.findByRole("button", { name: "Restore" }));
  await waitFor(() =>
    expect(screen.getByRole("navigation", { name: "Steps" })).toHaveTextContent("Study loaded, no video"),
  );
}

async function goToStep(user: ReturnType<typeof userEvent.setup>, step: keyof typeof STEP_GUIDES) {
  const nav = screen.getByRole("navigation", { name: "Steps" });
  await user.click(within(nav).getByRole("button", { name: new RegExp(STEP_GUIDES[step].name) }));
}

test("every monster can be chosen under every encounter", async () => {
  const user = userEvent.setup();
  render(<TaggerRoute />);
  const all = Object.keys(AUTHORED_MONSTER_FILES).toSorted();
  const encounterSelect = screen.getByRole("combobox", { name: "Encounter" });
  for (const option of within(encounterSelect).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)) {
    await user.selectOptions(encounterSelect, option);
    const monsters = within(screen.getByRole("combobox", { name: "Monster" }))
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(monsters.toSorted()).toEqual(all);
  }
  await user.selectOptions(screen.getByRole("combobox", { name: "Monster" }), "crystal-worm-child-head");
  expect(screen.getByRole("combobox", { name: "Monster" })).toHaveValue("crystal-worm-child-head");
});

test("flow 1: a saved session is listed and restoring it loads the study", async () => {
  const user = userEvent.setup();
  render(<TaggerRoute />);
  const row = (await screen.findByRole("button", { name: "Restore" })).closest("tr")!;
  expect(row).toHaveTextContent(study.provenance.fileName);
  await user.click(within(row).getByRole("button", { name: "Restore" }));
  const nav = screen.getByRole("navigation", { name: "Steps" });
  await waitFor(() => expect(nav).toHaveTextContent("Study loaded, no video"));
  const marks = study.tracks.reduce((sum, track) => sum + track.marks.length, study.scratch.length);
  expect(nav).toHaveTextContent(`${marks} marks`);
});

test("flow 2: editing an attack's cadence in the Attacks step keeps the typed value", async () => {
  const user = userEvent.setup();
  await restoreStudy(user);
  await goToStep(user, "attacks");
  const tracks = screen.getByRole("list", { name: "Attack tracks" });
  await user.click(within(tracks).getAllByRole("button")[0]);
  const input = await screen.findByRole("spinbutton", {
    name: `Cooldown after last shot (s) of ${firstTrack.attack.id}`,
  });
  await user.clear(input);
  await user.type(input, "3.25");
  await user.tab();
  await waitFor(() =>
    expect(
      screen.getByRole("spinbutton", { name: `Cooldown after last shot (s) of ${firstTrack.attack.id}` }),
    ).toHaveValue(3.25),
  );
  expect(within(tracks).getAllByRole("button")[0]).toHaveTextContent("typed");
});

test("flow 3: accepting a measured telegraph in the Reconcile step records it", async () => {
  const user = userEvent.setup();
  await restoreStudy(user);
  await goToStep(user, "reconcile");
  const [accept] = await screen.findAllByRole("button", { name: /^Accept telegraph for / });
  const row = accept.closest("tr")!;
  await user.click(accept);
  await waitFor(() => expect(row).toHaveTextContent(/accepted \d+\.\d{3} s/));
  expect(within(row).getByRole("button", { name: /^Clear telegraph for / })).toBeInTheDocument();
});

test("flow 4: Copy file puts exactly the exported monster file on the clipboard", async () => {
  const user = userEvent.setup();
  await restoreStudy(user);
  await goToStep(user, "reconcile");
  const expected = monsterFileTextFromStudy({
    archetypeId: study.archetypeId,
    study,
    currentRawFile: AUTHORED_MONSTER_FILES[study.archetypeId],
    config,
  });
  if (!expected.ok) throw new Error(expected.error);
  await user.click(await screen.findByRole("button", { name: "Copy file" }));
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(expected.value));
  expect(await screen.findByText("Copied.")).toBeInTheDocument();
});
