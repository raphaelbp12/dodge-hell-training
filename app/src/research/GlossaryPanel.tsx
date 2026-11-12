import { GLOSSARY } from "./glossary";
import { InfoDialog } from "./InfoDialog";
import styles from "./TaggerRoute.module.css";

/** A button that opens the tagger's glossary in a modal dialog. */
export function GlossaryPanel() {
  return (
    <InfoDialog label="Glossary" title="Glossary">
      <dl className={styles.glossaryList}>
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className={styles.glossaryEntry}>
            <dt>{entry.term}</dt>
            <dd>{entry.meaning}</dd>
          </div>
        ))}
      </dl>
    </InfoDialog>
  );
}
