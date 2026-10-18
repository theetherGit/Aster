# Contributing to Aster

## Setup

Node 24 and pnpm. The lockfile is frozen until the lab on 24 Oct 2026; do not run `pnpm update` or add dependencies without asking.

```sh
pnpm install
pnpm exec playwright install chromium   # once
pnpm dev                                # http://localhost:5173
```

## Tests

| Command         | What it runs                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test`     | Vitest: grammar fixtures, commands and the undo property, the `.mdj` golden and mutation tests, the `.aster` round trip, the token contrast test |
| `pnpm test:e2e` | Playwright against the production build: keyboard-only flows, open/save, export, the notation screenshot, the perf pan                           |
| `pnpm lint`     | Prettier and ESLint                                                                                                                              |
| `pnpm check`    | svelte-check, strict TypeScript                                                                                                                  |

Everything must be green before a commit. The notation screenshot has a macOS and a Linux baseline; after a deliberate visual change, update macOS locally with `pnpm exec playwright test tests/e2e/notation.spec.ts --update-snapshots` and record Linux with the "Linux visual baselines" workflow, then commit both. The manual accessibility script in `docs/manual-a11y-script.md` is run by a person; no commit may claim it passed.

## The rules that are not up for discussion

They are in [`CLAUDE.md`](CLAUDE.md); the two that shape every change:

**The model is the single source of truth.** `src/lib/model` holds the project. Svelte Flow nodes and edges are derived from it in `src/lib/stores/flow.svelte.ts` and never mutated. Every user action is a command in `src/lib/commands` built with `define(id, (project, args) => ({ label, touches, apply }))`; `apply` mutates the project in place and returns the inverse command. The stack coalesces moves, keeps 500 steps and serialises for autosave, so arguments must be plain data. If a feature needs state the model does not have, propose a change to `src/lib/model/types.ts` and wait; never edit it silently.

**Accessibility is a requirement.** Real `<button>`, `<a href>`, `<input>` with labels; interactive chrome on Bits UI primitives; the canvas and the Outline tree hand-built to the spec. Targets at least 24 × 24 px, focus always visible, 4.5:1 text contrast (`tests/unit/contrast.test.ts` checks the tokens), and every drag with a keyboard or menu equivalent. If a change cannot meet this, stop and say so.

## How to add a command

1. If it changes the model, write the model command in `src/lib/commands/<area>.ts` with `define`, returning its inverse, and a unit test that runs it and undoes it back to the start (`tests/unit/commands.test.ts` has the pattern).
2. Register the user-facing action once in `src/lib/app/commands.svelte.ts`: id, group, `label()` through `src/lib/i18n`, `keys` from `docs/spec/keyboard.md` (never invent a binding; add it to the spec first), `context` (`global` or `canvas`), `when` and `state` if it is a toggle, and `run`.
3. That is all: the keyboard router, the `⌘K` palette and the `?` sheet read the registry. `tests/unit/app-commands.test.ts` fails if a key from the spec is missing or two commands share one.

## Changes to the spec

`docs/spec/` is the specification. A change that deviates from it goes in [`DECISIONS.md`](DECISIONS.md) as one dated line with the reason, in the same commit. Boards in `docs/design/` (PNG for the look, `docs/design/html/` for structure, ARIA and copy) are a reference, not pixel specs; `docs/spec/ui.md` wins where they disagree.

## Commits

Conventional commits, one logical change each, never a broken build.
