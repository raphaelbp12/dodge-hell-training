import styles from "./TaggerRoute.module.css";

/**
 * V19 J12: a small `?` whose help text is its native `title` and its accessible
 * description. No tooltip component, positioning or keyboard-focus popup.
 */
export function HelpMark({ text }: Readonly<{ text: string }>) {
  return (
    <span
      className={styles.helpMark}
      role="img"
      aria-label="Help"
      aria-description={text}
      title={text}
    >
      ?
    </span>
  );
}
