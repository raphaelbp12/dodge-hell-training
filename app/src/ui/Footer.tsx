import { commitSha } from "virtual:build-info";
import styles from "../App.module.css";

const REPOSITORY_URL = "https://github.com/raphaelbp12/dodge-hell-training";
const SHORT_SHA_LENGTH = 7;

/** The deployed build's commit, or null when the build was not identified. */
function deployedCommit(): { short: string; url: string } | null {
  const sha = commitSha;
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return null;
  return {
    short: sha.slice(0, SHORT_SHA_LENGTH),
    url: `${REPOSITORY_URL}/commit/${sha}`,
  };
}

export function Footer() {
  const commit = deployedCommit();
  return (
    <footer className={styles.footer}>
      <nav aria-label="References">
        <a href="https://www.realmeye.com/wiki/crystal-worm-child">
          Enemy reference
        </a>
        <a href="https://www.realmofthemadgod.com/">Realm of the Mad God</a>
        <a href={REPOSITORY_URL}>Source code</a>
        {import.meta.env.DEV && <a href="?tagger=1">Video tagger (dev)</a>}
      </nav>
      <p className={styles.build}>
        {commit ? (
          <>
            Deployed build{" "}
            <a href={commit.url}>
              <code>{commit.short}</code>
            </a>
          </>
        ) : (
          <>Local build</>
        )}
      </p>
      <p>
        Unofficial practice encounter. Pursuit and timing include
        trainer-specific approximations.
      </p>
    </footer>
  );
}
