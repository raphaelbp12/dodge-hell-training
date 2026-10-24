import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createEncounter,
  type EncounterHandle,
  type EncounterView,
} from "./game/phaser/encounter";
import { PALADIN_STATS } from "./game/config/stats";
import { ENCOUNTER_CONFIG } from "./game/config/encounter";
import styles from "./App.module.css";

function Encounter({ zoomPreference }: { zoomPreference: RefObject<number> }) {
  const host = useRef<HTMLDivElement>(null);
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
    const handle = createEncounter(
      host.current!,
      (nextView) => {
        zoomPreference.current = nextView.zoom;
        setView(nextView);
      },
      { initialZoom: zoomPreference.current },
    );
    runtime.current = handle;
    return () => {
      runtime.current = null;
      handle.destroy();
    };
  }, [zoomPreference]);
  return (
    <>
      <div className={styles.telemetry}>
        <span className={styles.health}>
          <meter
            aria-label="Health"
            min={0}
            max={PALADIN_STATS.healthHp}
            value={view.healthHp}
          />
          {Math.ceil(view.healthHp)} / {PALADIN_STATS.healthHp} HP
        </span>
        <output aria-label="Survival time">
          {view.elapsedSeconds.toFixed(1)} s
        </output>
        <span>{view.hitsTaken} hits</span>
        <span role="status">
          {view.status === "ended"
            ? "Defeated"
            : view.status === "paused"
              ? "Paused"
              : view.status === "countdown"
                ? `Starting in ${Math.ceil(view.countdownRemainingSeconds)}`
                : "Active"}
        </span>
        {view.status === "paused" && (
          <button type="button" onClick={() => runtime.current?.resume()}>
            Resume
          </button>
        )}
        {(view.status === "paused" || view.status === "ended") && (
          <button type="button" onClick={() => runtime.current?.retry()}>
            Retry
          </button>
        )}
      </div>
      <div
        ref={host}
        tabIndex={0}
        role="region"
        aria-label="Encounter"
        className={styles.arena}
      />
    </>
  );
}

export default function App() {
  const [launched, setLaunched] = useState(false);
  const zoomPreference = useRef<number>(ENCOUNTER_CONFIG.camera.defaultZoom);
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Dodge Hell Training</span>
          <h1>Crystal Worm Child</h1>
        </div>
        <button type="button" onClick={() => setLaunched(!launched)}>
          {launched ? "Close encounter" : "Launch encounter"}
        </button>
      </header>
      <p className={styles.keyboardNotice}>Desktop keyboard required</p>
      {launched ? (
        <Encounter zoomPreference={zoomPreference} />
      ) : (
        <div className={styles.idle} aria-hidden="true">
          <div className={styles.crystal} />
        </div>
      )}
    </main>
  );
}
