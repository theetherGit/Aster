# Aster — rules for every session

Aster is an open-source, browser-based UML class modeller that reads and writes StarUML `.mdj` files. The full spec lives in `docs/spec/`. Read `overview.md`, `architecture.md` and `data-model.md` before touching anything; the rest as the task needs.

## Non-negotiables

1. **The UML model is the single source of truth.** `src/lib/model` holds it. Svelte Flow nodes and edges are _derived_ from model + layout and are never mutated directly. Every user action is a command in `src/lib/commands` that returns its inverse. No feature may bypass this, including "quick fixes".
2. **`src/lib/model/types.ts` and `src/lib/commands/types.ts` are hand-authored.** Propose changes in your plan and wait for approval; never edit them silently.
3. **Tests first** for anything with acceptance criteria in `docs/spec/features.md`. A slice is done when its named tests pass and its acceptance criteria are met — not when it looks done.
4. **Accessibility is a requirement, not polish.** Real `<button>`, `<a href>`, `<input>` with labels — never `role`/`onClick` on a `div` or `span`. Every interactive target ≥ 24×24 CSS px. Every drag has a keyboard or menu equivalent. Focus is never removed (`outline: none` only with a replacement). Text contrast 4.5:1, UI edges 3:1. If a change cannot meet this, stop and say so.
5. **Interactive chrome is built on Bits UI primitives** (menus, context menus, dialogs, popovers, tooltips, tabs, select, combobox, toggle groups, toolbars), styled with our tokens — never hand-rolled. The Outline tree and everything on the canvas are hand-built to the spec because no primitive fits them. No shadcn-svelte or any styled kit.
6. **Keyboard shortcuts come from `docs/spec/keyboard.md`.** Never invent a binding. Where StarUML already has one for the same action, we use it.
7. **Nothing from a later milestone gets built early.** Each feature's milestone is in `docs/spec/features.md`. If a fix would be easy but belongs later, note it in `DECISIONS.md` and leave it.
8. **Every deviation from the spec goes in `DECISIONS.md`** as one line with the reason, in the same change.
9. **Strings users see go through `src/lib/i18n`** from day one, even though only English ships.
10. **Dependencies are minimal.** Ask before adding one.

## Working style

- Conventional commits; one logical change per commit; never commit a broken build.
- Plan first, in writing; keep plans short and scoped to the prompt.
- When a prompt says "do not build X", do not build X even partially.
- Finish every slice with: what was built, what was left, `DECISIONS.md` entries, and the test run output.
- The manual accessibility script in `docs/manual-a11y-script.md` is run by a human. Never claim it passed.

## Layout

```
src/lib/model      plain TS model + factories           (no Svelte imports)
src/lib/commands   one function per user action; inverses; the undo stack
src/lib/mdj        parseMdj / serializeMdj / expression grammar
src/lib/puml       PlantUML dialect parser/printer      (M2)
src/lib/stores     project, layout, selection, ui; derived flowNodes/flowEdges
src/lib/canvas     Svelte Flow instance, node and edge components
src/lib/panels     explorer/outline, inspector, toolbox, palette, dialogs
src/lib/persist    IndexedDB autosave, recents, File System Access
src/lib/i18n       message files + helpers
src/routes         the two layout presets as arrangements of the same panels
tests/unit         vitest
tests/e2e          playwright (keyboard-only and axe runs live here)
fixtures/mdj       real StarUML files — the codec's truth
fixtures/grammar   expression lines + expected parses
docs/spec          the specification (read-only for you unless asked)
```

Import from `src/lib` as `#lib/<path>/<file>.ts` (or `.svelte`), always with the full file path and extension: SvelteKit 3 uses Node subpath imports, which resolve neither `$lib` nor directory indexes.
