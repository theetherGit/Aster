# Design — Aster

Locked design system. Future design work reads this file first; screens defer to it. Amend
intentionally — the file is the rule. The spec in `docs/spec/ui.md` wins where the two disagree,
and the difference goes in `DECISIONS.md`.

## System

- Genre · utilitarian tool chrome around a white paper (the canvas is the product; chrome stays out of its way)
- Macrostructure · workbench: 44 px top bar, floating toolbox, Outline drawer left, inspector right, status footer; Classic is StarUML's arrangement of the same parts
- Theme · Aster's own, from `docs/spec/ui.md`: Modern light, Modern dark, Classic (always light), High contrast
- Axes · light or dark paper band by theme / system sans, one weight step for titles / one cool blue accent (yellow in high contrast), amber for warnings, red for delete; nothing else coloured

## Tokens (canonical · `src/lib/ui/tokens.css` is the source of truth)

Every colour and size in a component comes through a token. Chrome and paper colours are the
spec's table, kept as hex (4.5:1 text, 3:1 edges in every theme, checked by `tests/unit/contrast.test.ts`).

```css
:root {
	/* Chrome */
	--chrome-bg --chrome-surface --chrome-border --chrome-text --chrome-muted
	--accent --accent-fill --accent-text --on-accent --warning --danger
	--control-border --control-radius --selection-tint
	--kbd-text --kbd-fill --kbd-edge            /* key caps; a surface may set its own (the paper, a primary button) */
	/* Paper (always white) */
	--paper-bg --paper-grid --paper-ink --paper-fill --paper-accent --paper-muted --uml-stroke
	/* Scales */
	--space-1 … --space-16                       /* 4 pt grid */
	--text-caption --text-small --text-body --text-field --text-lead --text-title --text-display
	--font-chrome --font-mono --font-paper
	--radius-card --radius-menu --radius-pill    /* controls use --control-radius: 6 px Modern, 3 px Classic */
	--dur-micro --dur-short --dur-long --ease-out --ease-in-out
	--z-footer --z-toolbox --z-inspector-float --z-banner --z-toast --z-notice --z-dialog --z-tooltip --z-drop
	--shadow-float --shadow-menu --shadow-toast --shadow-dialog
	--control-min --control-icon --control-bar  /* 24 / 28 / 32 px */
}
```

## Type

- Chrome · `--font-chrome` (system UI) at `--text-body` 13 px; captions 11–12 px; field text 14 px; sheet titles 17 px; the welcome's name 28 px. Weights 400 and 600, and 500 for Secondary and Ghost button labels only. No italic in chrome.
- Paper · `--font-paper` (bundled Source Sans 3) at 12 px for members, 13 px semibold for names. Italic means abstract, underline means static (UML, not style).
- Mono · `--font-mono` only in the inline member editor and the Text view.

## Components — the atomic map

Three layers. The layer says where a thing lives and what may back it.

| Layer    | Lives in                             | Backed by                                                 | Examples                                                                                                                                              |
| -------- | ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atom     | `src/lib/ui/atoms/`                  | one Bits UI primitive, or one native element, plus tokens | Button, IconButton, Kbd, KbdGroup, Icon, Tooltip, Field, Checkbox, Select, Segment, Tab, Separator, MenuItem, DialogFrame, SectionHeading, PanelTitle |
| Molecule | `src/lib/ui/molecules/`              | atoms only, no stores                                     | InlineName, Toast, Banner, ConfirmDialog, PanelHeader, EmptyState, KeyHint                                                                            |
| Organism | `src/lib/panels/`, `src/lib/canvas/` | molecules, atoms, the stores and the command registry     | TopBar, Explorer, Inspector, Toolbox, Palette, the sheets, nodes and edges                                                                            |

Rules:

- Atoms and molecules are written in Tailwind utilities, merged with `cn()` (the `cn` package, a
  clsx + tailwind-merge replacement) so a caller's class can override an atom's. The shared dress
  no atom can wrap (a Select trigger, a menu surface, a menu row) lives as class strings in
  `src/lib/ui/styles.ts`; nothing in the layer is hand-written CSS. Utilities reach tokens through
  the `@theme` map (`bg-chrome-surface`, `rounded-control`, `shadow-menu`) or a `(--var)` reference
  (`h-(--control-icon)`, `text-(length:--text-body)`, `z-(--z-dialog)`).
- Interactive chrome is a Bits UI primitive styled with tokens (menus, context menus, menubar, dialogs, popovers, tooltips, tabs, select, combobox, toggle groups, toolbars, collapsibles, separators). No styled kit, no hand-rolled copies.
- Form fields are real `<input>`, `<textarea>`, `<label>` and native checkboxes, styled by the Field and Checkbox atoms.
- The Outline tree and everything on the paper are hand-built to the spec; no primitive fits them.
- A new piece goes to the lowest layer that can hold it. If it needs a store, it is an organism.
- Every interactive atom ships its states: rest, hover, focus-visible (2 px dashed accent ring, solid and flush on text fields), active, disabled with a reason, and where it applies busy, error and success.
- Keys: every key the UI shows is the Kbd atom (after shadcn-svelte's Kbd, in our tokens): a 20 px cap, full-strength text on an 8 % tint of it, chrome font. Menus and the palette use its `quiet` form, the platform's shortcut column. A hint never spells a key in its copy: the message carries `{placeholders}` and KeyHint draws them as caps. Keys follow the platform (⌘ ⇧ ↩ ⌫ on macOS; Ctrl, Shift, Enter, Backspace elsewhere), and a glyph cap carries its name for screen readers.
- Targets are at least `--control-min` (24 px). Icon buttons are `--control-icon` (28 px). Bars' pills are `--control-bar` (32 px).

## CTA voice

- Primary · `--accent-fill` with `--on-accent`, `--control-radius`, 12 px side padding, weight 600 (Download, Save and open, New diagram on the welcome)
- Secondary · `--control-border` outline on `--chrome-surface`, same radius, weight 500 (Export, Copy)
- Ghost · no border, `--chrome-muted` text, hover to `--chrome-text`, weight 500 (Preview, Clear, Dismiss, Cancel)
- Danger · `--danger` fill with `--on-accent`, only on the confirm of a destructive action
- Buttons are one line; labels are verbs; a disabled control says why in its tooltip

## Motion stance

- Nearly silent. Panels slide along x in `--dur-short` with `--ease-out`; menus, dialogs and tooltips appear in place; nothing on the paper animates except the canvas's own zoom and fit.
- Reduced motion · every CSS transition is zeroed in `layout.css`, and Svelte-driven transitions return zero duration (`src/lib/ui/motion.ts`).
- Focus rings never animate.

## Exports

- `src/lib/ui/tokens.css` · source of truth, loaded by `src/routes/layout.css`; `src/lib/ui/styles.ts` · the shared class strings
- `src/lib/ui/tokens.css` § `@theme inline` · Tailwind v4 theme, reading the same variables, so utilities such as `bg-chrome-surface` and `text-accent-text` never drift
- `src/lib/ui/tokens.json` · DTCG tokens, generated by `pnpm tokens` from `tokens.css`; `tests/unit/tokens.test.ts` fails when they drift
- shadcn-style variables · not shipped. Aster uses Bits UI directly; a consumer who needs `--background`/`--foreground` names maps `--chrome-bg`/`--chrome-text` in their own layer
