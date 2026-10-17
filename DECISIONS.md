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
- 2026-10-17 · fixtures · the three OOAD lab `.mdj` files are not available; the golden corpus will be public files only, and the extra grammar lines will be copied from those · owner does not have the lab files.
- 2026-10-17 · commands · `moveNode` takes `ids[]` and coalesces on the sorted id set, not a single element · nudging a multi-selection must be one undo step.
- 2026-10-17 · commands · a coalesced step keeps a flattened batch of inverses instead of merging deltas · generic for any coalescing command; a long drag undoes as one step of many tiny moves.
- 2026-10-17 · commands · undo and redo reselect the elements the step touched that are still on the diagram · gives Enter, arrows and Backspace a target straight after an undo; this is what `Command.touches` is for.
- 2026-10-17 · canvas · the keyboard router sits on a focusable `role="application"` container, with Svelte's two non-interactive-element a11y warnings suppressed there · the spec makes the diagram one Tab stop whose keys the app routes; it is not a fake button.
- 2026-10-17 · canvas · paper text uses a system humanist sans stack, not the bundled OFL font · font bundling belongs with export, where cross-OS identity matters.
- 2026-10-17 · ui · theme follows `prefers-color-scheme` only; no explicit light/dark/high-contrast switch yet · the `⌘⌥T` toggle and high-contrast tokens are a later slice.
- 2026-10-17 · ui · diagram tabs are Bits UI Tabs with the canvas area as the tabpanel · keeps the tab/tabpanel ARIA relationship real instead of empty panels.
- 2026-10-17 · tooling · e2e tests reselect nodes by `.class-node[data-name]` · nodes are not focusable until the M2 canvas keyboard model, so there is no role to query yet.
