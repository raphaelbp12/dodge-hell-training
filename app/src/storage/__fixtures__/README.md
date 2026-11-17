# Frozen persistence fixtures (storage)

Each file here is one saved attempt-history payload, written by the code of its schema version. **Never edit a fixture.** The live site's players keep history saved by older versions, so every fixture must keep loading. A schema change adds a new `attempts.v<N>.json` beside the old one; it never rewrites one. See plan V22 A14 and `docs/quality-gates.md`.
