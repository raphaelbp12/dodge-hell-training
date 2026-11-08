import type { ReactNode } from "react";
import styles from "../App.module.css";

type ChangelogEntry = Readonly<{
  date: string;
  label: string;
  items: readonly ReactNode[];
}>;

const ENTRIES: readonly ChangelogEntry[] = [
  {
    date: "2026-11-06",
    label: "6 Nov 2026",
    items: [
      "New dark interface, with a live phase preview on the home screen and the fight's progress beside the arena.",
      "Personal best now follows the encounter and phases you selected. The Killer Bee Queen's best was not being shown before.",
      "Honey is darker, so attacks stand out against it.",
    ],
  },
  {
    date: "2026-11-05",
    label: "5 Nov 2026",
    items: [
      "The player's body is now a symmetric 5 x 7 core: shorter than before and without the lateral arm bump, with its hitbox following the same shape.",
      "Both encounters have a new comparison identity, so earlier attempts show as other rules.",
    ],
  },
  {
    date: "2026-11-04",
    label: "4 Nov 2026",
    items: [
      "Killer Bee Queen phase 3 is retuned from tagged reference footage.",
      "The Nest is now an octagonal boss room with Killer Honey: the centre pond and outer ring slow you and deal 60 armor-piercing damage every second.",
      "Phase-3 drills start the Queen at the arena centre instead of walking her in.",
      "Sprites are re-scaled to the measured 9-pixel tile grid; both encounters have a new comparison identity, so earlier attempts remain as other rules.",
      "HUD controls now wrap on narrow screens instead of overflowing.",
    ],
  },
  {
    date: "2026-11-03",
    label: "3 Nov 2026",
    items: [
      "New phase selector: train the full fight or any set of phases, loop them, and apply a change live from the HUD.",
      "The live panel shows which phase is playing.",
    ],
  },
  {
    date: "2026-10-30",
    label: "30 Oct 2026",
    items: [
      "The Queen's projectiles are pixel art now, with hitboxes that follow each sprite's shape.",
      "Bombs play a five-frame detonation effect.",
      "New Queen comparison identity; earlier attempts no longer count toward the best.",
    ],
  },
  {
    date: "2026-10-29",
    label: "29 Oct 2026",
    items: [
      "New boss: the Killer Bee Queen, with eight phases to practice.",
      "Status effects like Paralyzed, Slowed and Confused now change how you move.",
      <>
        Add <code>?phase=</code> and <code>?loop=1</code> to practice a single
        phase.
      </>,
      "Choose which encounter to train on the home screen.",
    ],
  },
  {
    date: "2026-10-26",
    label: "26 Oct 2026",
    items: [
      "Heads now arrive over time, up to four at once, each firing on its own clock.",
      <>
        Arena and enemies are authored as data; add <code>?seed=</code> to
        replay an opening.
      </>,
      "New comparison identity; earlier records are kept as other rules.",
    ],
  },
  {
    date: "2026-10-25",
    label: "25 Oct 2026",
    items: [
      "V2 polygon encounter with eleven-shot spirals and versioned comparisons.",
      "Reload-safe zoom, player health bar and individual hit amounts.",
      "Original hit audio, visit-local mute and Home/HUD Controls.",
    ],
  },
  {
    date: "2026-10-24",
    label: "24 Oct 2026",
    items: [
      "Crystal Worm Child Head encounter with returning shard bursts.",
      "Pause, immediate retry, and attempt results.",
      "Local attempt history and retained personal best by rules version.",
    ],
  },
];

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <>
      <time dateTime={entry.date}>{entry.label}</time>
      <ul>
        {entry.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </>
  );
}

export function Changelog() {
  const [latest, ...earlier] = ENTRIES;
  return (
    <section className={styles.changelog} aria-labelledby="changelog-title">
      <h2 id="changelog-title">Changelog</h2>
      <Entry entry={latest} />
      <details>
        <summary>Earlier changes</summary>
        {earlier.map((entry) => (
          <Entry key={entry.date} entry={entry} />
        ))}
      </details>
    </section>
  );
}
