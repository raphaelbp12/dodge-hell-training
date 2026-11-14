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

// Plan V21 B01: the tagger is reachable in every environment. It stays a
// lazily loaded chunk (no second entry point) that only `?tagger=1` fetches,
// so a player who never opens it downloads nothing extra.
if (isTaggerRequested(window.location.search)) {
  void import("./research/TaggerRoute")
    .then(({ TaggerRoute }) => {
      root.render(
        <StrictMode>
          <TaggerRoute />
        </StrictMode>,
      );
    })
    .catch((error: unknown) => {
      // A stale chunk must not leave a blank page.
      console.error("Failed to load the tagger", error);
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
