# Design boards

Screenshots of the Aster UI Design canvas. App boards are 1280×800 and the notation sheet is 1600×1100, all exported at 2×. When a prompt or the spec says "board NN", it means the file here. They're a visual reference, not pixel specs: where a board and `docs/spec/ui.md` disagree, `ui.md` wins. Log the difference in `DECISIONS.md`.

| Board                                | File                           | Used by                                                                                                           |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 01 Modern · dark                     | `01-modern-dark.png`           | Day 1 shell, Day 3 notation                                                                                       |
| 02 Modern · light                    | `02-modern-light.png`          | Day 6 themes                                                                                                      |
| 03 Classic (StarUML-like)            | `03-classic.png`               | M2.6                                                                                                              |
| 04 Inline UML text editing           | `04-inline-editing.png`        | Day 2                                                                                                             |
| 05 Relationship picker               | `05-relationship-picker.png`   | Day 3                                                                                                             |
| 06 Export sheet                      | `06-export-sheet.png`          | Day 5, M3.4                                                                                                       |
| 07 Welcome screen                    | `07-welcome.png`               | Day 5, Day 6                                                                                                      |
| 08 Import notice                     | `08-import-notice.png`         | Day 4                                                                                                             |
| 09 Text view                         | `09-text-view.png`             | M2.4                                                                                                              |
| 10 Keyboard focus and narration      | `10-keyboard-focus.png`        | M2.1, M2.2                                                                                                        |
| 11 High contrast                     | `11-high-contrast.png`         | M2.5                                                                                                              |
| 12 UML notation reference            | `12-uml-notation.png`          | Day 3 snapshot review, Day 6 notes, M3.1 packages. The truth for markers, labels, line styles and on-paper states |
| 13 Relationship selected · inspector | `13-relationship-selected.png` | Day 3 inspector, label and waypoint alternatives to dragging                                                      |
| 14 Note selected · inspector         | `14-note-selected.png`         | Day 6 notes                                                                                                       |
| 15 Diagram tab · display defaults    | `15-diagram-tab.png`           | Day 6 display toggles                                                                                             |
| 16 Command palette                   | `16-command-palette.png`       | Day 6                                                                                                             |
| 17 Shortcut sheet                    | `17-shortcut-sheet.png`        | Day 6, generated from the registry                                                                                |
| 18 New empty diagram                 | `18-empty-diagram.png`         | Day 5                                                                                                             |
| 19 Removed from diagram · undo toast | `19-undo-toast.png`            | Day 5, M2.1                                                                                                       |
| 20 Unsaved changes prompt            | `20-unsaved-prompt.png`        | Day 5                                                                                                             |
| 21 File dragged over the window      | `21-drop-file.png`             | Day 4–5                                                                                                           |
| 22 File that won't open              | `22-open-error.png`            | Day 4–5                                                                                                           |

Notes on the new boards:

- The inspector collapses to a 40 px rail with one button (`⌘\`) when nothing is selected (18, 19).
- Display shortcuts change the selection when there is one, else the diagram defaults (15). A class changed on its own stops following the defaults.
- "Show property strings" has no shortcut: `⌘⇧P` is the palette alias, so it can't also be a display toggle.
- The narration bar on board 10 is the aria-live region made visible for the mockup. In the app it stays visually hidden unless captions are turned on.
