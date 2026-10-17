# Decisions

One line per deviation from the spec, with the reason, added in the same change.

- 2026-10-17: `docs/spec/` was absent at bootstrap; folder layout taken from the bootstrap brief, spec files to be added by the owner.
- 2026-10-17: Vitest runs a single node-environment project over `tests/unit`; no browser/component mode until a component needs one.
- 2026-10-17: CI runs Playwright on Chromium only, to keep the pipeline fast; add browsers when a browser-specific bug appears.
- 2026-10-17: `bits-ui` pulls `runed`, which declares a peer on `@sveltejs/kit` ^2 while the project is on kit 3; the warning is accepted since build and check pass.
- 2026-10-17: Licence holder name inferred as "Shivam Meena" from the git/user identity; the brief left a placeholder.
