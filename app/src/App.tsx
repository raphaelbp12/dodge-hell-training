import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createEncounter,
  type EncounterHandle,
  type EncounterView,
} from "./game/phaser/encounter";
import { PALADIN_STATS } from "./game/config/stats";
import { ENCOUNTER_CONFIG, RULES_VERSION } from "./game/config/encounter";
import {
  AttemptHistory,
  retainedBestSeconds,
  type HistorySnapshot,
} from "./storage/attempts";
import styles from "./App.module.css";
import { ZoomPreference } from "./storage/zoom";

function ControlsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={styles.controls} aria-labelledby="controls-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key === "Tab") { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
  }}>
    <h2 id="controls-title">Controls</h2>
    <dl>
      <dt>WASD</dt><dd>Move</dd>
      <dt>R</dt><dd>Immediate retry</dd>
      <dt>O / P</dt><dd>Zoom out / in</dd>
      <dt>Escape</dt><dd>Pause / resume, or close Controls</dd>
      <dt>Mute</dt><dd>Hit audio checkbox</dd>
      <dt>Resume</dt><dd>Continue a paused attempt</dd>
      <dt>Start / Retry / Home</dt><dd>Screen actions</dd>
      <dt>Tab / Shift+Tab</dt><dd>Move focus</dd>
      <dt>Enter / Space</dt><dd>Activate a focused control</dd>
    </dl>
    <button type="button" autoFocus onClick={onClose}>Close</button>
  </dialog>;
}

function History({ snapshot }: { snapshot: HistorySnapshot }) {
  const best = retainedBestSeconds(snapshot.records, RULES_VERSION);
  return (
    <section className={styles.history} aria-label="Attempt history">
      <p>
        Retained personal best{" "}
        <strong aria-label="Retained personal best">
          {best === null ? "None" : `${best.toFixed(2)} s`}
        </strong>
      </p>
      <small>
        Current rules / latest {ENCOUNTER_CONFIG.session.historyLimit} completed
        attempts
      </small>
      <details open>
        <summary>Recent attempts ({snapshot.records.length})</summary>
        {snapshot.records.length ? (
          <ol aria-label="Recent attempts">
            {snapshot.records.map((record) => (
              <li
                key={record.id}
                aria-label={`Completed attempt: ${record.elapsedSeconds.toFixed(2)} seconds, ${record.hitsTaken} hits`}
              >
                <span>{record.elapsedSeconds.toFixed(2)} s</span>
                <span>{record.hitsTaken} hits</span>
                <span title={record.rulesVersion}>
                  {record.rulesVersion === RULES_VERSION
                    ? "Current rules"
                    : "Other rules"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No completed attempts</p>
        )}
      </details>
      {snapshot.warning && <p role="status">{snapshot.warning}</p>}
    </section>
  );
}

function Encounter({
  zoomPreference,
  zoomStorage,
  muted,
  onHome,
  history,
  historySnapshot,
  onHistoryChange,
}: {
  zoomPreference: RefObject<number>;
  zoomStorage: ZoomPreference;
  muted: boolean;
  onHome: () => void;
  history: AttemptHistory;
  historySnapshot: HistorySnapshot;
  onHistoryChange: (snapshot: HistorySnapshot) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const runtime = useRef<EncounterHandle | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const initialMuted = useRef(muted);
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
    const runtimeId = crypto.randomUUID();
    const recordedAttempts = new Set<number>();
    const handle = createEncounter(
      host.current!,
      (nextView) => {
        if (!active) return;
        zoomPreference.current = nextView.zoom;
        setView(nextView);
      },
      {
        initialZoom: zoomPreference.current,
        initialMuted: initialMuted.current,
        onZoomChange: (zoom) => {
          if (!active) return;
          zoomPreference.current = zoom;
          zoomStorage.set(zoom);
        },
        onResult: (result) => {
          if (!active || recordedAttempts.has(result.attemptId)) return;
          recordedAttempts.add(result.attemptId);
          const { attemptId, ...metrics } = result;
          onHistoryChange(
            history.save({ id: `${runtimeId}:${attemptId}`, ...metrics }),
          );
        },
      },
    );
    runtime.current = handle;
    return () => {
      active = false;
      runtime.current = null;
      handle.destroy();
    };
  }, [zoomPreference, zoomStorage, history, onHistoryChange]);
  useEffect(() => { runtime.current?.setMuted(muted); }, [muted]);
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
          <button type="button" onClick={() => { runtime.current?.setControlsOpen(true); setControlsOpen(true); }}>Controls</button>
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
        {view.status === "paused" && <div className={`${styles.countdown} ${styles.paused}`} aria-label="Paused overlay">Paused</div>}
        {view.result && (
          <section className={styles.results} aria-labelledby="result-title">
            <span className={styles.eyebrow}>Crystal Worm Child Head</span>
            <h2 id="result-title" ref={resultHeading} tabIndex={-1}>
              Attempt complete
            </h2>
            {!!view.finalHitAmounts?.length && <div role="group" aria-label="Final hit amounts" className={styles.finalHits}>
              {view.finalHitAmounts.map((amount, index) => <span key={index}>-{amount}</span>)}
            </div>}
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
            <History snapshot={historySnapshot} />
          </section>
        )}
      </div>
      {controlsOpen && <ControlsDialog onClose={() => { runtime.current?.setControlsOpen(false); setControlsOpen(false); }} />}
    </>
  );
}

export default function App() {
  const [history] = useState(
    () => new AttemptHistory(() => window.localStorage),
  );
  const [historySnapshot, setHistorySnapshot] = useState(() =>
    history.snapshot(),
  );
  const [launched, setLaunched] = useState(false);
  const [homeControlsOpen, setHomeControlsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const [zoomStorage] = useState(() => new ZoomPreference(() => window.localStorage));
  const zoomPreference = useRef<number>(zoomStorage.get());
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
        <div className={styles.headerTools}>
          <span className={styles.encounterLabel}>Head / Survival</span>
          <label className={styles.mute}><input type="checkbox" aria-label="Mute hit audio" checked={muted} onChange={(event) => setMuted(event.target.checked)} />Mute</label>
        </div>
      </header>
      <p className={styles.keyboardNotice}>Desktop keyboard required</p>
      {launched ? (
        <Encounter
          zoomPreference={zoomPreference}
          zoomStorage={zoomStorage}
          muted={muted}
          onHome={() => setLaunched(false)}
          history={history}
          historySnapshot={historySnapshot}
          onHistoryChange={setHistorySnapshot}
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
              <button type="button" className={styles.homeControls} onClick={() => setHomeControlsOpen(true)}>Controls</button>
            </div>
          </section>
          <section className={styles.preset} aria-labelledby="preset-title">
            <h2 id="preset-title">Paladin</h2>
            <span>{PALADIN_STATS.healthHp} HP</span>
            <span>{PALADIN_STATS.vitality} VIT</span>
            <span>{PALADIN_STATS.speed} SPD</span>
            <span>{PALADIN_STATS.defense} DEF</span>
          </section>
          <History snapshot={historySnapshot} />
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
              <li>
                Local attempt history and retained personal best by rules
                version.
              </li>
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
          {homeControlsOpen && <ControlsDialog onClose={() => setHomeControlsOpen(false)} />}
        </div>
      )}
    </main>
  );
}
