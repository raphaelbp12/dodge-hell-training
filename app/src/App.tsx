import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createEncounter,
  type EncounterHandle,
  type EncounterView,
} from "./game/phaser/encounter";
import { PALADIN_STATS } from "./game/config/stats";
import { ENCOUNTER_CONFIG } from "./game/config/encounter";
import styles from "./App.module.css";

function Encounter({
  zoomPreference,
  onHome,
}: {
  zoomPreference: RefObject<number>;
  onHome: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const runtime = useRef<EncounterHandle | null>(null);
  const [view, setView] = useState<EncounterView>({
    healthHp: PALADIN_STATS.healthHp,
    elapsedSeconds: 0,
    hitsTaken: 0,
    status: "countdown",
    countdownRemainingSeconds: ENCOUNTER_CONFIG.session.startCountdownSeconds,
    zoom: zoomPreference.current,
    result: null,
  });
  useEffect(() => {
    if (view.result) resultHeading.current?.focus();
  }, [view.result]);
  useEffect(() => {
    let active = true;
    const handle = createEncounter(
      host.current!,
      (nextView) => {
        if (!active) return;
        zoomPreference.current = nextView.zoom;
        setView(nextView);
      },
      { initialZoom: zoomPreference.current },
    );
    runtime.current = handle;
    return () => {
      active = false;
      runtime.current = null;
      handle.destroy();
    };
  }, [zoomPreference]);
  return (
    <>
      <div className={styles.telemetry} aria-label="Session HUD">
        <span className={styles.health}>
          <meter
            aria-label="Health"
            min={0}
            max={PALADIN_STATS.healthHp}
            value={view.healthHp}
          />
          {Math.ceil(view.healthHp)} / {PALADIN_STATS.healthHp} HP
        </span>
        <output aria-label="Survival time" aria-live="off">
          {view.elapsedSeconds.toFixed(1)} s
        </output>
        <span>{view.hitsTaken} hits</span>
        <span aria-label="Primary stats" className={styles.stats}>
          <span>{PALADIN_STATS.vitality} VIT</span>
          <span>{PALADIN_STATS.speed} SPD</span>
          <span>{PALADIN_STATS.defense} DEF</span>
        </span>
        <span role="status" aria-label="Session status">
          {view.status === "ended"
            ? "Defeated"
            : view.status === "paused"
              ? "Paused"
              : view.status === "countdown"
                ? "Starting"
                : "Active"}
        </span>
        <div
          className={`${styles.actions} ${view.result ? styles.hiddenActions : ""}`}
          inert={!!view.result}
          aria-hidden={!!view.result}
        >
          <button
            type="button"
            disabled={view.status !== "paused"}
            onClick={() => runtime.current?.resume()}
          >
            Resume
          </button>
          <button type="button" onClick={() => runtime.current?.retry()}>
            Retry
          </button>
          <button type="button" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
      <div className={styles.playfield}>
        <div
          ref={host}
          tabIndex={0}
          role="region"
          aria-label="Encounter"
          className={styles.arena}
        />
        {view.status === "countdown" && (
          <div className={styles.countdown} aria-hidden="true">
            {Math.ceil(view.countdownRemainingSeconds)}
          </div>
        )}
        {view.result && (
          <section className={styles.results} aria-labelledby="result-title">
            <span className={styles.eyebrow}>Crystal Worm Child Head</span>
            <h2 id="result-title" ref={resultHeading} tabIndex={-1}>
              Attempt complete
            </h2>
            <dl>
              <div>
                <dt>Survival time</dt>
                <dd>{view.result.elapsedSeconds.toFixed(2)} s</dd>
              </div>
              <div>
                <dt>Hits taken</dt>
                <dd>{view.result.hitsTaken}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="button"
                onClick={() => runtime.current?.retry()}
              >
                Retry
              </button>
              <button type="button" onClick={onHome}>
                Home
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [launched, setLaunched] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const zoomPreference = useRef<number>(ENCOUNTER_CONFIG.camera.defaultZoom);
  useEffect(() => {
    if (!launched) startButton.current?.focus();
  }, [launched]);
  return (
    <main className={`${styles.shell} ${launched ? styles.session : ""}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Dodge Hell Training</span>
          <h1>Crystal Worm Child</h1>
        </div>
        <span className={styles.encounterLabel}>Head / Survival</span>
      </header>
      <p className={styles.keyboardNotice}>Desktop keyboard required</p>
      {launched ? (
        <Encounter
          zoomPreference={zoomPreference}
          onHome={() => setLaunched(false)}
        />
      ) : (
        <div className={styles.home}>
          <section className={styles.intro} aria-labelledby="practice-title">
            <div className={styles.specimen} aria-hidden="true">
              <div className={styles.crystal} />
            </div>
            <div>
              <span className={styles.eyebrow}>01 / Crystal cavern</span>
              <h2 id="practice-title">Crystal Worm Child Head</h2>
              <p>
                Survive the returning shards of a single pursuing head. A fixed
                Paladin, one arena, and another attempt whenever you are ready.
              </p>
              <button
                ref={startButton}
                className={styles.primary}
                type="button"
                onClick={() => setLaunched(true)}
              >
                Start
              </button>
            </div>
          </section>
          <section className={styles.preset} aria-labelledby="preset-title">
            <h2 id="preset-title">Paladin</h2>
            <span>{PALADIN_STATS.healthHp} HP</span>
            <span>{PALADIN_STATS.vitality} VIT</span>
            <span>{PALADIN_STATS.speed} SPD</span>
            <span>{PALADIN_STATS.defense} DEF</span>
          </section>
          <section
            className={styles.changelog}
            aria-labelledby="changelog-title"
          >
            <h2 id="changelog-title">Changelog</h2>
            <time dateTime="2026-10-24">24 Oct 2026</time>
            <ul>
              <li>
                Crystal Worm Child Head encounter with returning shard bursts.
              </li>
              <li>Pause, immediate retry, and attempt results.</li>
            </ul>
          </section>
          <footer className={styles.footer}>
            <nav aria-label="References">
              <a href="https://www.realmeye.com/wiki/crystal-worm-child">
                Enemy reference
              </a>
              <a href="https://www.realmofthemadgod.com/">
                Realm of the Mad God
              </a>
            </nav>
            <p>
              Unofficial practice encounter. Pursuit and timing include
              trainer-specific approximations.
            </p>
          </footer>
        </div>
      )}
    </main>
  );
}
