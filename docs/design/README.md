# Design boards

Screenshots of the Aster UI Design canvas. App boards are 1280×800 and the notation sheet is 1600×1100, all exported at 2×. When a prompt or the spec says "board NN", it means the file here. They're a visual reference, not pixel specs: where a board and `docs/spec/ui.md` disagree, `ui.md` wins. Log the difference in `DECISIONS.md`.

| Board                                | File                           | Used by                                                                                                                         |
| ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 01 Modern · dark                     | `01-modern-dark.png`           | Day 1 shell, Day 3 notation                                                                                                     |
| 02 Modern · light                    | `02-modern-light.png`          | Day 6 themes                                                                                                                    |
| 03 Classic (StarUML-like)            | `03-classic.png`               | M2.6                                                                                                                            |
| 04 Inline UML text editing           | `04-inline-editing.png`        | Day 2                                                                                                                           |
| 05 Relationship picker               | `05-relationship-picker.png`   | Day 3                                                                                                                           |
| 06 Export sheet                      | `06-export-sheet.png`          | Day 5, M3.4                                                                                                                     |
| 07 Welcome page · first visit        | `07-welcome.png`               | Day 5–6. Full-window page: Aster mark (Hairline figure), New, Open file (.aster/.mdj), sample card with thumbnail, empty Recent |
| 08 Import notice                     | `08-import-notice.png`         | Day 4                                                                                                                           |
| 09 Text view                         | `09-text-view.png`             | M2.4                                                                                                                            |
| 10 Keyboard focus and narration      | `10-keyboard-focus.png`        | M2.1, M2.2                                                                                                                      |
| 11 High contrast                     | `11-high-contrast.png`         | M2.5                                                                                                                            |
| 12 UML notation reference            | `12-uml-notation.png`          | Day 3 snapshot review, Day 6 notes, M3.1 packages. The truth for markers, labels, line styles and on-paper states               |
| 13 Relationship selected · inspector | `13-relationship-selected.png` | Day 3 inspector, label and waypoint alternatives to dragging                                                                    |
| 14 Note selected · inspector         | `14-note-selected.png`         | Day 6 notes                                                                                                                     |
| 15 Diagram tab · display defaults    | `15-diagram-tab.png`           | Day 6 display toggles                                                                                                           |
| 16 Command palette                   | `16-command-palette.png`       | Day 6                                                                                                                           |
| 17 Shortcut sheet                    | `17-shortcut-sheet.png`        | Day 6, generated from the registry                                                                                              |
| 18 New empty diagram                 | `18-empty-diagram.png`         | Day 5                                                                                                                           |
| 19 Removed from diagram · undo toast | `19-undo-toast.png`            | Day 5, M2.1                                                                                                                     |
| 20 Unsaved changes prompt            | `20-unsaved-prompt.png`        | Day 5                                                                                                                           |
| 21 File dragged over the window      | `21-drop-file.png`             | Day 4–5                                                                                                                         |
| 22 File that won't open              | `22-open-error.png`            | Day 4–5                                                                                                                         |
| 23 Welcome page · returning          | `23-welcome-returning.png`     | Day 5–6. Same page in dark with three recents, each showing where it lives                                                      |

## HTML snapshots

`html/` has every board as a static HTML file with the same number and name as its PNG, plus `html/index.html` to browse them. Read the PNG for the look and the HTML for everything a picture can't give you: element structure, ARIA roles and labels, the exact copy, and sizes, spacing and radii in px.

The HTML snapshots are **reference only, not production code**:

- Inline styles are the tokens resolved to hex for that board's theme; the comment at the top of each file maps the hex values back to token names. In the app, every colour comes from the token CSS variables in `docs/spec/ui.md`.
- Diagram positions are fixed for the picture. In the app they come from the model and layout.
- Don't copy inline styles or absolute positioning. Rebuild each piece as a Svelte component on the primitives below.

| On the board                                       | Build it with                                                |
| -------------------------------------------------- | ------------------------------------------------------------ |
| Diagram tabs, inspector tabs, Classic Editors tabs | Bits UI Tabs                                                 |
| Relationship picker                                | Bits UI DropdownMenu, anchored at the drop point             |
| Export sheet                                       | Bits UI Dialog                                               |
| Unsaved changes prompt                             | Bits UI AlertDialog                                          |
| Command palette                                    | Bits UI Command inside a Dialog                              |
| Line style and stereotype segments                 | Bits UI ToggleGroup                                          |
| Type completion while editing                      | Bits UI Combobox                                             |
| Right-click / ⇧F10 menu                            | Bits UI ContextMenu                                          |
| Toolbox key hints                                  | Bits UI Tooltip                                              |
| Classic menu bar and toolbar                       | Bits UI Menubar and Toolbar                                  |
| Import notice, open error, undo toast              | Plain `role="status"` / `role="alert"` regions, no primitive |
| Canvas, nodes, edges, Outline tree                 | Hand-built, per the spec                                     |

## Notes on the new boards

- The inspector collapses to a 40 px rail with one button (`⌘\`) when nothing is selected (18, 19).
- Display shortcuts change the selection when there is one, else the diagram defaults (15). A class changed on its own stops following the defaults.
- "Show property strings" has no shortcut: `⌘⇧P` is the palette alias, so it can't also be a display toggle.
- The narration bar on board 10 is the aria-live region made visible for the mockup. In the app it stays visually hidden unless captions are turned on.
