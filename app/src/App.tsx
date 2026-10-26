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
import {
  DEBUG_GROUPS,
  DEBUG_PARAMETERS,
  DEBUG_RULES_VERSION,
  DEBUG_TOGGLES,
  DEFAULT_DEBUG_SETTINGS,
  loadSelectedDebugValues,
  updateDebugParameter,
  type DebugSettings,
} from "./game/config/debug";

/**
 * Optional `?seed=<integer>` pins spawn placement, so a run can be reproduced
 * or shared. Omitted or invalid means a varied opening.
 */
function readSeedFromLocation(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) return undefined;
  const seed = Number(raw);
  return Number.isFinite(seed) ? Math.trunc(seed) : undefined;
}

function DebugPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: DebugSettings;
  onChange: (settings: DebugSettings) => void;
  onClose: () => void;
}) {
  return (
    <aside
      id="debug-tools"
      aria-label="Enemy debug tools"
      data-debug-tools
      className={styles.debugPanel}
    >
      <div className={styles.debugHeading}>
        <h2>Enemy debug</h2>
        <button type="button" onClick={onClose}>
          Close debug
        </button>
      </div>
      <button
        className={styles.debugLoad}
        type="button"
        onClick={() => onChange(loadSelectedDebugValues(settings))}
      >
        Load selected values
      </button>
      {DEBUG_TOGGLES.map((toggle) => (
        <label key={toggle.key} className={styles.debugToggle}>
          <input
            type="checkbox"
            checked={settings[toggle.key]}
            onChange={(event) =>
              onChange({ ...settings, [toggle.key]: event.target.checked })
            }
          />
          {toggle.label}
        </label>
      ))}
      {DEBUG_GROUPS.map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {DEBUG_PARAMETERS.filter(
            (parameter) => parameter.group === group,
          ).map((parameter) => (
            <label key={parameter.key} className={styles.debugParameter}>
              <span>{parameter.label}</span>
              <output>
                {Number(settings[parameter.key].toFixed(3))} {parameter.unit}
              </output>
              <input
                type="range"
                aria-label={parameter.label}
                data-debug-parameter={parameter.key}
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={settings[parameter.key]}
                onChange={(event) =>
                  onChange(
                    updateDebugParameter(
                      settings,
                      parameter.key,
                      Number(event.target.value),
                    ),
                  )
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange(DEFAULT_DEBUG_SETTINGS)}>
        Reset defaults
      </button>
    </aside>
  );
}

function ControlsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.controls}
      aria-labelledby="controls-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <h2 id="controls-title">Controls</h2>
      <dl>
        <dt>WASD</dt>
        <dd>Move</dd>
        <dt>R</dt>
        <dd>Immediate retry</dd>
        <dt>O / P</dt>
        <dd>Zoom out / in</dd>
        <dt>Escape</dt>
        <dd>Pause / resume, or close Controls</dd>
        <dt>Mute</dt>
        <dd>Hit audio checkbox</dd>
        <dt>Resume</dt>
        <dd>Continue a paused attempt</dd>
        <dt>Start / Retry / Home</dt>
        <dd>Screen actions</dd>
        <dt>Tab / Shift+Tab</dt>
        <dd>Move focus</dd>
        <dt>Enter / Space</dt>
        <dd>Activate a focused control</dd>
      </dl>
      <button type="button" autoFocus onClick={onClose}>
        Close
      </button>
    </dialog>
  );
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
  debugSettings,
  onHome,
  history,
  historySnapshot,
  onHistoryChange,
}: {
  zoomPreference: RefObject<number>;
  zoomStorage: ZoomPreference;
  muted: boolean;
  debugSettings: DebugSettings;
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
  const initialDebugSettings = useRef(debugSettings);
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
        seed: readSeedFromLocation(),
        initialZoom: zoomPreference.current,
        initialMuted: initialMuted.current,
        initialDebugSettings: initialDebugSettings.current,
        onZoomChange: (zoom) => {
          if (!active) return;
          zoomPreference.current = zoom;
          zoomStorage.set(zoom);
        },
        onResult: (result) => {
          if (result.rulesVersion === DEBUG_RULES_VERSION) return;
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
  useEffect(() => {
    runtime.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    runtime.current?.setDebugSettings(debugSettings);
  }, [debugSettings]);
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
        {view.debug && (
          <span className={styles.debugBadge}>Debug attempt / not saved</span>
        )}
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
          <button
            type="button"
            onClick={() => {
              runtime.current?.setControlsOpen(true);
              setControlsOpen(true);
            }}
          >
            Controls
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
        {view.status === "paused" && (
          <div
            className={`${styles.countdown} ${styles.paused}`}
            aria-label="Paused overlay"
          >
            Paused
          </div>
        )}
        {view.result && (
          <section className={styles.results} aria-labelledby="result-title">
            <span className={styles.eyebrow}>Crystal Worm Child Head</span>
            <h2 id="result-title" ref={resultHeading} tabIndex={-1}>
              Attempt complete
            </h2>
            {view.result.rulesVersion === DEBUG_RULES_VERSION && (
              <p className={styles.debugBadge}>Debug attempt / not saved</p>
            )}
            {!!view.finalHitAmounts?.length && (
              <div
                role="group"
                aria-label="Final hit amounts"
                className={styles.finalHits}
              >
                {view.finalHitAmounts.map((amount, index) => (
                  <span key={index}>-{amount}</span>
                ))}
              </div>
            )}
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
      {controlsOpen && (
        <ControlsDialog
          onClose={() => {
            runtime.current?.setControlsOpen(false);
            setControlsOpen(false);
          }}
        />
      )}
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugSettings, setDebugSettings] = useState<DebugSettings>(
    DEFAULT_DEBUG_SETTINGS,
  );
  const debugButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [zoomStorage] = useState(
    () => new ZoomPreference(() => window.localStorage),
  );
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
          <button
            ref={debugButton}
            type="button"
            data-debug-tools
            aria-expanded={debugOpen}
            aria-controls="debug-tools"
            onClick={() => setDebugOpen(!debugOpen)}
          >
            Debug
          </button>
          <span className={styles.encounterLabel}>Head / Survival</span>
          <label className={styles.mute}>
            <input
              type="checkbox"
              aria-label="Mute hit audio"
              checked={muted}
              onChange={(event) => setMuted(event.target.checked)}
            />
            Mute
          </label>
        </div>
      </header>
      <p className={styles.keyboardNotice}>Desktop keyboard required</p>
      <div className={styles.debugLayout}>
        <div className={styles.mainContent}>
          {launched ? (
            <Encounter
              zoomPreference={zoomPreference}
              zoomStorage={zoomStorage}
              muted={muted}
              debugSettings={debugSettings}
              onHome={() => setLaunched(false)}
              history={history}
              historySnapshot={historySnapshot}
              onHistoryChange={setHistorySnapshot}
            />
          ) : (
            <div className={styles.home}>
              <section
                className={styles.intro}
                aria-labelledby="practice-title"
              >
                <div className={styles.specimen} aria-hidden="true">
                  <div className={styles.crystal} />
                </div>
                <div>
                  <span className={styles.eyebrow}>01 / Crystal cavern</span>
                  <h2 id="practice-title">Crystal Worm Child Head</h2>
                  <p>
                    Survive the returning shards of a single pursuing head. A
                    fixed Paladin, one arena, and another attempt whenever you
                    are ready.
                  </p>
                  <button
                    ref={startButton}
                    className={styles.primary}
                    type="button"
                    onClick={() => setLaunched(true)}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className={styles.homeControls}
                    onClick={() => setHomeControlsOpen(true)}
                  >
                    Controls
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
              <History snapshot={historySnapshot} />
              <section
                className={styles.changelog}
                aria-labelledby="changelog-title"
              >
                <h2 id="changelog-title">Changelog</h2>
                <time dateTime="2026-10-26">26 Oct 2026</time>
                <ul>
                  <li>
                    Heads now arrive over time, up to four at once, each firing
                    on its own clock.
                  </li>
                  <li>
                    Arena and enemies are authored as data; add{" "}
                    <code>?seed=</code> to replay an opening.
                  </li>
                  <li>
                    New comparison identity; earlier records are kept as other
                    rules.
                  </li>
                </ul>
                <time dateTime="2026-10-25">25 Oct 2026</time>
                <ul>
                  <li>
                    V2 polygon encounter with eleven-shot spirals and versioned
                    comparisons.
                  </li>
                  <li>
                    Reload-safe zoom, player health bar and individual hit
                    amounts.
                  </li>
                  <li>
                    Original hit audio, visit-local mute and Home/HUD Controls.
                  </li>
                </ul>
                <time dateTime="2026-10-24">24 Oct 2026</time>
                <ul>
                  <li>
                    Crystal Worm Child Head encounter with returning shard
                    bursts.
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
              {homeControlsOpen && (
                <ControlsDialog onClose={() => setHomeControlsOpen(false)} />
              )}
            </div>
          )}
        </div>
        {debugOpen && (
          <DebugPanel
            settings={debugSettings}
            onChange={setDebugSettings}
            onClose={() => {
              setDebugOpen(false);
              debugButton.current?.focus();
            }}
          />
        )}
      </div>
    </main>
  );
}
