import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/grenze-gotisch/wght.css";
import "@fontsource/barlow-semi-condensed/latin-500.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "./global.css";
import App from "./App.tsx";
import { paletteCssVariables } from "./game/config/palette";
import { isTaggerRequested } from "./research/taggingRoute";

for (const [name, value] of Object.entries(paletteCssVariables()))
  document.documentElement.style.setProperty(name, value);
// Phaser text draws with whatever is loaded, so ask for the face early.
void document.fonts?.load('600 18px "Barlow Semi Condensed"');

const root = createRoot(document.getElementById("root")!);

// Plan V8 T14: the tagger is a development-only route. The `DEV` guard is the
// whole mechanism - Vite replaces it with `false` in a production build, so the
// dynamic import and its chunk are dropped and no second entry point exists.
if (import.meta.env.DEV && isTaggerRequested(window.location.search)) {
  void import("./research/TaggerRoute")
    .then(({ TaggerRoute }) => {
      root.render(
        <StrictMode>
          <TaggerRoute />
        </StrictMode>,
      );
    })
    .catch((error: unknown) => {
      // A stale dev chunk must not leave a blank page.
      console.error("Failed to load the development tagger", error);
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
