import { useEffect, useRef, useState } from "react";
import type { EncounterHandle } from "./game/phaser/encounter";
import { PALADIN_STATS, PALADIN_DERIVED_STATS } from "./game/config/stats";
import {
  DEBUG_TUNABLE_ENCOUNTER_ID,
  DEFAULT_ENCOUNTER_ID,
  ENCOUNTER_LIST,
  encounterConfigOf,
  primaryArchetype,
} from "./game/config/encounter";
import { AttemptHistory } from "./storage/attempts";
import styles from "./App.module.css";
import { ZoomPreference } from "./storage/zoom";
import { parseDrillFromLocation, phaseLabel } from "./game/config/drill";
import type { DrillSelection } from "./game/models";
import { PhaseSelector } from "./ui/PhaseSelector";
import { DEFAULT_DEBUG_SETTINGS, type DebugSettings } from "./game/config/debug";
import { DebugPanel } from "./ui/DebugPanel";
import { ControlsDialog } from "./ui/ControlsDialog";
import { History } from "./ui/History";
import { selectedRulesVersion } from "./ui/historyModel";
import { EncounterScreen } from "./ui/EncounterScreen";
import { Changelog } from "./ui/Changelog";
import { Footer } from "./ui/Footer";
import { ArenaPlate } from "./ui/ArenaPlate";
import { PhaseDossier } from "./ui/PhaseDossier";
import { PhasePreview, motionAllowed } from "./ui/PhasePreview";

/** The Paladin's authored equipment, matching `PALADIN_EQUIPMENT_BONUSES`. */
const PALADIN_EQUIPMENT = [
  "Archon Sword",
  "Vengeance Armor",
  "Seal of the Divine",
  "Ring of Paramount Health",
] as const;

/**
 * K14: `?encounter=<id>` links a specific encounter; an unknown id is ignored
 * and the default (the Queen) is kept, matching how `?seed=` already handles
 * bad input.
 */
function readEncounterIdFromLocation(): string | undefined {
  const raw = new URLSearchParams(window.location.search).get("encounter");
  if (raw === null) return undefined;
  return ENCOUNTER_LIST.some((entry) => entry.id === raw) ? raw : undefined;
}

export default function App() {
  const [history] = useState(
    () => new AttemptHistory(() => window.localStorage),
  );
  const [historySnapshot, setHistorySnapshot] = useState(() =>
    history.snapshot(),
  );
  const [launched, setLaunched] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState(
    () => readEncounterIdFromLocation() ?? DEFAULT_ENCOUNTER_ID,
  );
  const selectedEncounter =
    ENCOUNTER_LIST.find((entry) => entry.id === selectedEncounterId) ??
    ENCOUNTER_LIST[0];
  const selectedConfig = encounterConfigOf(selectedEncounterId);
  const isDebugTunable = selectedEncounterId === DEBUG_TUNABLE_ENCOUNTER_ID;
  const [drill, setDrill] = useState<DrillSelection | null>(() =>
    parseDrillFromLocation(encounterConfigOf(selectedEncounterId)),
  );
  const [previewPhase, setPreviewPhase] = useState<number | null>(null);
  const phases = primaryArchetype(selectedConfig).phases.map((phase, index) => ({
    index,
    id: phase.id,
    label: phaseLabel(phase.id, index),
  }));
  const shownPhaseIndex = previewPhase ?? drill?.phaseIndices[0] ?? 0;
  const [homeControlsOpen, setHomeControlsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugSettings, setDebugSettings] = useState<DebugSettings>(
    DEFAULT_DEBUG_SETTINGS,
  );
  const debugButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const encounterHandle = useRef<EncounterHandle | null>(null);
  const [zoomStorage] = useState(
    () => new ZoomPreference(() => window.localStorage),
  );
  const zoomPreference = useRef<number>(zoomStorage.get());
  useEffect(() => {
    if (!launched) startButton.current?.focus();
  }, [launched]);
  const rulesVersion = selectedRulesVersion(selectedConfig, drill);
  // The Mute checkbox and Debug button live in the Home header and, once an
  // attempt starts, in the session rail; one fragment keeps handlers identical.
  const sessionTools = (
    <>
      <label className={styles.mute}>
        <input
          type="checkbox"
          aria-label="Mute hit audio"
          checked={muted}
          onChange={(event) => setMuted(event.target.checked)}
        />
        Mute
      </label>
      {isDebugTunable && (
        <button
          ref={debugButton}
          type="button"
          data-debug-tools
          aria-expanded={debugOpen}
          aria-controls="debug-tools"
          onClick={() => setDebugOpen((open) => !open)}
        >
          Debug
        </button>
      )}
    </>
  );
  return (
    <main
      className={`${styles.shell} ${launched ? styles.session : ""}`}
      data-encounter={selectedEncounterId}
    >
      {!launched && (
        <header className={styles.header}>
          <span className={styles.brand}>Dodge Hell Training</span>
          <div className={styles.headerTools}>
            <button type="button" onClick={() => setHomeControlsOpen(true)}>
              Controls
            </button>
            {sessionTools}
          </div>
        </header>
      )}
      <p className={styles.keyboardNotice}>Desktop keyboard required</p>
      <div className={styles.debugLayout}>
        <div className={styles.mainContent}>
          {launched ? (
            <EncounterScreen
              zoomPreference={zoomPreference}
              zoomStorage={zoomStorage}
              muted={muted}
              debugSettings={debugSettings}
              onHome={() => {
                setLaunched(false);
                setDrill(null);
              }}
              history={history}
              historySnapshot={historySnapshot}
              onHistoryChange={setHistorySnapshot}
              encounterHandle={encounterHandle}
              config={selectedConfig}
              displayName={selectedEncounter.displayName}
              drill={drill}
              onDrillChange={setDrill}
              debugOpen={debugOpen}
              onDebugOpenChange={setDebugOpen}
              sessionTools={sessionTools}
            />
          ) : (
            <div className={styles.home}>
              <section
                className={styles.hero}
                aria-label="Encounter selection"
              >
                <div className={styles.heroControls}>
                  <fieldset
                    className={styles.encounterChoice}
                    aria-label="Encounter"
                  >
                    {ENCOUNTER_LIST.map((entry) => (
                      <label key={entry.id}>
                        <input
                          type="radio"
                          name="encounter"
                          value={entry.id}
                          checked={selectedEncounterId === entry.id}
                          onChange={() => {
                            setSelectedEncounterId(entry.id);
                            setDrill(null);
                            setPreviewPhase(null);
                          }}
                        />
                        {entry.displayName}
                      </label>
                    ))}
                  </fieldset>
                  <h1 className={styles.bossName}>
                    {selectedEncounter.displayName}
                  </h1>
                  <p>
                    A fixed Paladin, one arena, and another attempt whenever
                    you are ready.
                  </p>
                  <PhaseSelector
                    mode="home"
                    phases={phases}
                    drill={drill}
                    onChange={setDrill}
                    onPreviewPhase={setPreviewPhase}
                  />
                  <button
                    ref={startButton}
                    className={styles.primary}
                    type="button"
                    onClick={() => {
                      setLaunched(true);
                      setDebugOpen(false);
                      setPreviewPhase(null);
                    }}
                  >
                    Start
                  </button>
                </div>
                <div className={styles.heroStage}>
                  <div className={styles.stagePlate}>
                    <ArenaPlate arena={selectedConfig.arena} />
                    <PhasePreview
                      config={selectedConfig}
                      phaseIndex={shownPhaseIndex}
                    />
                  </div>
                  {motionAllowed() && (
                    <p className={styles.previewCaption}>
                      Live preview. The Paladin stands still here.
                    </p>
                  )}
                  <PhaseDossier
                    config={selectedConfig}
                    phaseIndex={shownPhaseIndex}
                    label={phases[shownPhaseIndex].label}
                  />
                </div>
              </section>
              <section className={styles.record} aria-labelledby="record-title">
                <h2 id="record-title">Practice record</h2>
                <History
                  snapshot={historySnapshot}
                  rulesVersion={rulesVersion}
                />
              </section>
              <section className={styles.preset} aria-labelledby="preset-title">
                <h2 id="preset-title">Paladin</h2>
                <span>{PALADIN_STATS.healthHp} HP</span>
                <span>{PALADIN_STATS.vitality} VIT</span>
                <span>{PALADIN_STATS.speed} SPD</span>
                <span>{PALADIN_STATS.defense} DEF</span>
                <span>
                  {PALADIN_DERIVED_STATS.speedTilesPerSecond.toFixed(1)} tiles/s
                </span>
                <span>
                  {PALADIN_DERIVED_STATS.regenerationHpPerSecond.toFixed(1)}{" "}
                  HP/s regeneration
                </span>
                <ul aria-label="Equipment">
                  {PALADIN_EQUIPMENT.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <Changelog />
              <Footer />
              {homeControlsOpen && (
                <ControlsDialog onClose={() => setHomeControlsOpen(false)} />
              )}
            </div>
          )}
        </div>
        {isDebugTunable && debugOpen && (
          <DebugPanel
            settings={debugSettings}
            onChange={setDebugSettings}
            onClose={() => {
              setDebugOpen(false);
              debugButton.current?.focus();
            }}
            encounterHandle={encounterHandle}
          />
        )}
      </div>
    </main>
  );
}
