import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./TaggerRoute.module.css";

/**
 * A header button that opens read-only help in a modal dialog. The glossary
 * and the step guide share it, so both open, close and look the same.
 */
export function InfoDialog({
  label,
  title,
  children,
}: Readonly<{
  /** The button's text. */
  label: string;
  /** The dialog's heading and accessible name. */
  title: string;
  children: ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
        {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className={styles.glossaryDialog}
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.glossaryHeader}>
            <h2 id={titleId}>{title}</h2>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {children}
        </dialog>
      )}
    </>
  );
}
