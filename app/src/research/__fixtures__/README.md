# Frozen persistence fixtures (research)

Each `study.v<N>.json` is one tagger study in schema version N, and `tagger-session.json` is one autosave payload. **Never edit a fixture.** Saved studies and autosaves on the live site must keep loading, so every fixture must keep loading and migrate to the current version. A schema change adds a new fixture (for example `study.v6.json`) and never rewrites an old one. See plan V22 A14 and `docs/quality-gates.md`.
