import type { ReactNode } from "react";
import styles from "./TaggerRoute.module.css";

/**
 * A number input that commits on blur or Enter and restores its text when the
 * edit is refused, so a rejected value never lingers in the row.
 */
export function CommitInput({
  value,
  label,
  onCommit,
  blankAllowed = false,
  step = "1",
  caption,
  help,
}: {
  value: string;
  label: string;
  onCommit: (text: string) => boolean;
  blankAllowed?: boolean;
  step?: string;
  /** A short visible name; the `label` stays the accessible name (V16 S20). */
  caption?: string;
  /** A help mark shown beside the caption, never beside the input. */
  help?: ReactNode;
}) {
  const input = (
    <input
      key={value}
      className={styles.cellInput}
      type="number"
      step={step}
      aria-label={label}
      defaultValue={value}
      onBlur={(event) => {
        const text = event.currentTarget.value;
        if (text === value || (blankAllowed && text === "" && value === ""))
          return;
        if (!onCommit(text)) event.currentTarget.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
  if (caption === undefined) return input;
  return (
    <label className={styles.cellCaption}>
      <small>{caption}</small>
      {help}
      {input}
    </label>
  );
}
