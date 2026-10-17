# Decisions

One line per deviation from `docs/spec/`, with the reason, added in the same change. Newest at the bottom. Format: `YYYY-MM-DD · area · what · why`.

- 2026-10-17 · tooling · Bits UI (headless) is the only UI library; shadcn-svelte rejected · two layouts and three themes need unopinionated chrome with library-owned ARIA and focus behaviour.
- 2026-10-17 · model · `Relationship.targetId` is the whole (diamond side) for aggregation and composition · matches StarUML's end2 and makes "connect part to whole" the gesture.
- 2026-10-17 · model · `EdgeLayout.waypoints` stores interior points only; border endpoints are recomputed · StarUML's first/last `points` are derived from node bounds and go stale when nodes move.
- 2026-10-17 · tooling · Vitest runs one node-environment project over `tests/unit`, no browser/component mode · nothing needs a DOM yet; add when a component test does.
- 2026-10-17 · tooling · CI runs Playwright on Chromium only · keeps the pipeline fast; add browsers when a browser-specific bug appears.
- 2026-10-17 · tooling · `bits-ui` → `runed` declares a peer on `@sveltejs/kit` ^2 while the project is on kit 3; warning accepted · build and check pass.
- 2026-10-17 · tooling · hand-authored `src/lib/model/types.ts` and `src/lib/commands/types.ts` are excluded from Prettier · they keep the owner's formatting; the tool must not rewrite files it may not edit.
- 2026-10-17 · tooling · `src/lib` is imported as `#lib/<file>.js` (full path), not `$lib` · SvelteKit 3 replaced the `$lib` alias with Node subpath imports, which do not resolve directory indexes.
