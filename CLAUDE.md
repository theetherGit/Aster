# Aster — project rules

Aster is a browser-based UML class modeller that reads and writes StarUML `.mdj`
files. The spec is in `docs/spec/`; read `overview.md`, `architecture.md` and
`data-model.md` before touching code, and the rest as the task needs.

## Architecture

- **The UML model in `src/lib/model` is the single source of truth.** Svelte Flow
  nodes and edges are derived from it and are never mutated directly. Every user
  action is a command in `src/lib/commands` that returns its inverse. No feature
  may bypass this, for any reason.
- **`src/lib/model/types.ts` and `src/lib/commands/types.ts` are hand-authored.**
  Propose changes to them and wait for approval. Never edit them silently.

## Process

- **Tests first** for anything with acceptance criteria in `docs/spec/features.md`.
  A slice is done when its named tests pass and its acceptance criteria are met,
  not when it looks done.
- **Nothing from a later milestone gets built early.** Every feature's milestone
  is in `docs/spec/features.md`; check it before starting.
- **Any deviation from the spec goes into `DECISIONS.md`** as one line with the
  reason, in the same change that introduces it.
- **Commits:** conventional commits, one logical change per commit, never a
  commit that breaks the build.
- **Dependencies stay minimal.** Ask before adding one.

## Accessibility (a requirement, not polish)

- Real `<button>`, `<a>`, `<input>` with labels. Never `role` plus `onclick` on a `div`.
- Every interactive target is at least 24 by 24 CSS px.
- Every drag has a keyboard or menu equivalent.
- Focus is never removed from the user.
- Text contrast is at least 4.5:1.
- If a change cannot meet these, stop and say so instead of shipping it.

## UI

- **Keyboard shortcuts come from `docs/spec/keyboard.md`.** Never invent a binding.
- **Interactive chrome is built on Bits UI primitives**, never hand-rolled: menus,
  context menus, dialogs, popovers, tooltips, tabs, select, combobox, toggle
  groups and toolbars. ARIA and focus behaviour come from the library; styling
  comes from our own tokens. Bits UI is the only UI library; no shadcn-svelte or
  other styled kit.
- **The Outline tree and everything on the canvas are hand-built to the spec**,
  because no primitive fits them.
- **Every user-visible string goes through `src/lib/i18n`** from day one, even
  though only English ships.

## Tooling

- pnpm, Node 24, SvelteKit 3 with Svelte 5 runes, TypeScript strict, static adapter.
- Import from `src/lib` via `#lib/<path>.js` with the full file path (Node subpath imports; no directory index resolution).
- Scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`, `format`, `check`.
  All of them must be green before a commit.
