import { useEffect, useRef, useState } from "react";
import { GLOSSARY } from "./glossary";
import styles from "./TaggerRoute.module.css";

/** A button that opens the tagger's glossary in a modal dialog. */
export function GlossaryPanel() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => {
      if (typeof element.close === "function") element.close();
      else element.removeAttribute("open");
    };
  }, [open]);

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Glossary
      </button>
      {open && (
        <dialog
          ref={dialog}
          className={styles.glossaryDialog}
          aria-labelledby="glossary-title"
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.glossaryHeader}>
            <h2 id="glossary-title">Glossary</h2>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <dl className={styles.glossaryList}>
            {GLOSSARY.map((entry) => (
              <div key={entry.term} className={styles.glossaryEntry}>
                <dt>{entry.term}</dt>
                <dd>{entry.meaning}</dd>
              </div>
            ))}
          </dl>
        </dialog>
      )}
    </>
  );
}
