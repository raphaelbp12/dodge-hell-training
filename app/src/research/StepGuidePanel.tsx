import { InfoDialog } from "./InfoDialog";
import { STEP_GUIDES } from "./stepGuide";
import type { TaggerStep } from "./TaggerControls";
import styles from "./TaggerRoute.module.css";

/** A button that explains the selected step: what it is for and what to do. */
export function StepGuidePanel({ step }: Readonly<{ step: TaggerStep }>) {
  const guide = STEP_GUIDES[step];
  return (
    <InfoDialog label="Step guide" title={`How to: ${guide.name}`}>
      <div className={styles.guide}>
        <p className={styles.guidePurpose}>{guide.purpose}</p>
        <h3>What to do</h3>
        <ol className={styles.guideActions}>
          {guide.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
        {guide.tips.length > 0 && (
          <>
            <h3>Good to know</h3>
            <ul className={styles.guideTips}>
              {guide.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </InfoDialog>
  );
}
