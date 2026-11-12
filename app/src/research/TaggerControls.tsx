import type { ReactNode } from "react";
import styles from "./TaggerRoute.module.css";

/** The tagger's working steps, in the order a study is usually made. */
export type TaggerStep = "setup" | "tag" | "review" | "draft";

export type StepItem = Readonly<{
  id: TaggerStep;
  name: string;
  /** A short line saying where this step stands, such as "3 tags". */
  status: string;
  done?: boolean;
}>;

/**
 * The numbered step bar. Every step stays reachable at any time; the numbers
 * show the usual order, not a gate.
 */
export function StepNav({
  steps,
  current,
  onChoose,
}: Readonly<{
  steps: readonly StepItem[];
  current: TaggerStep;
  onChoose: (step: TaggerStep) => void;
}>) {
  return (
    <nav className={styles.steps} aria-label="Steps">
      <ol>
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              className={styles.step}
              aria-current={current === step.id ? "step" : undefined}
              onClick={() => onChoose(step.id)}
            >
              <span className={styles.stepNumber} data-done={step.done || undefined} aria-hidden="true">
                {step.done ? "✓" : index + 1}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepName}>{step.name}</span>
                <span className={styles.stepStatus}>{step.status}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A row of radio buttons drawn as one segmented control. The inputs stay
 * native radios, so arrow keys and screen readers work as usual.
 */
export function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  help,
  label = (option) => option,
}: Readonly<{
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  help?: ReactNode;
  label?: (option: T) => string;
}>) {
  return (
    <fieldset className={styles.formRow}>
      <legend className={styles.formLabel}>
        {legend}
        {help}
      </legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{label(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
