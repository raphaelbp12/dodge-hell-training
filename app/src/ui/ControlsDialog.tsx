import { Fragment, useEffect, useRef } from "react";
import {
  CONDITION_DESCRIPTIONS,
  CONDITION_KEYS,
  CONDITION_LABELS,
  INERT_CONDITIONS,
} from "../game/simulation/conditions";
import styles from "../App.module.css";

const isInert = (key: string) =>
  (INERT_CONDITIONS as readonly string[]).includes(key);

export function ControlsDialog({ onClose }: { onClose: () => void }) {
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
  const conditionKeys = [
    ...CONDITION_KEYS.filter((key) => !isInert(key)),
    ...CONDITION_KEYS.filter(isInert),
  ];
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
      <h3>Keys</h3>
      <dl>
        <dt>
          <kbd>WASD</kbd>
        </dt>
        <dd>Move</dd>
        <dt>
          <kbd>R</kbd>
        </dt>
        <dd>Immediate retry</dd>
        <dt>
          <kbd>O / P</kbd>
        </dt>
        <dd>Zoom out / in</dd>
        <dt>
          <kbd>Escape</kbd>
        </dt>
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
      <h3>Status effects</h3>
      <dl>
        {conditionKeys.map((key) => (
          <Fragment key={key}>
            <dt>
              {CONDITION_LABELS[key]}
              {isInert(key) && " (inert)"}
            </dt>
            <dd>{CONDITION_DESCRIPTIONS[key]}</dd>
          </Fragment>
        ))}
      </dl>
      <button type="button" autoFocus onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}
