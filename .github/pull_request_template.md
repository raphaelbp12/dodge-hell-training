## Summary

<!-- What changed and why, in two or three sentences. -->

## Gates run

<!-- Paste the printed lines of `npm run verify` from `app/`. -->

```
```

Mark each gate "ran" with its result, or "not applicable" with the reason (see [quality gates](../docs/quality-gates.md)):

- [ ] `npm run test:soak:sim`:
- [ ] `npm run bench` and the base-versus-head gate (simulation hot path: `simulation.ts`, `projectiles.ts`, `bombs.ts`, `geometry.ts`):
- [ ] `npm run test:mutation:diff` (modules in the mutate globs), mutation score of the changed files:

## Rules

- [ ] `rulesVersion` changed: yes / no
- [ ] `app/src/game/config/rules-fingerprint.json` changed: yes / no

## Deferred register

- [ ] An item in `docs/deferred-work.md` was touched: no / yes, approved by:

## Independent review

<!-- Required when the pull request changes `app/` or `.github/workflows/`: `/code-review high <number> --comment` run by a session that did not author it. Otherwise "not applicable" with the reason. -->

- Reviewing model:
- Date:
- Number of findings:
- Per finding, "fixed" or "declined" with the reason:

## Findings

<!-- Any failing property, contract or mutation finding raised under plan V22 A10, with its seed, path and counterexample; or "none". -->
