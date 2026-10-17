# UI design

The canvas is the product; chrome exists to stay out of its way. Modern puts a floating toolbox over the paper and a single right inspector; Classic puts StarUML's panels where StarUML puts them. Same components, same tokens, different arrangement and density. The design canvas (Claude Design artifact "Aster UI Design", eleven boards) is the visual reference; board numbers below refer to it.

## Modern layout (default) — boards 01, 02

No menu bar; a 44 px top bar with the project name, unsaved dot, diagram tabs, undo/redo, zoom, Export button, palette button. The toolbox floats top-left over the canvas as a vertical pill of six tools (Select, Class, Interface, Enum, Package, Link) with their single-letter keys on hover. The Outline is a 240 px left drawer, hidden by default, toggled with `⌘B`. The inspector is a 300 px right panel (360 px when the Text tab is active) with tabs Properties / Text / Diagram, collapsing when nothing is selected. The canvas paper is a soft dot grid. A status footer bottom-left shows counts and autosave time; when captions are on it becomes the narration bar (board 10).

## Classic layout — board 03

StarUML's own arrangement so a switcher's hands still work: a 28 px menu bar (File, Edit, Format, Model, View, Help, generated from the command registry), a 36 px toolbar row of icon buttons, a 200 px left column with _Working Diagrams_ (the open diagrams list) above the _Toolbox_ (tools by group, with labels), the canvas in the middle, and a 280 px right column with _Model Explorer_ above _Editors_, where Editors has three tabs — Style, Property, Documentation — exactly as StarUML names them. Grey chrome, 1 px separators, 24 px rows, white paper with a fine line grid, pale-yellow class fill. It should feel like a tidier StarUML 7, not a parody of it; `Ctrl+1–6` toggle the same panels they do there.

## Visual language (both)

- Flat chrome, 1 px borders, 6 px radius on controls in Modern and 3 px in Classic; shadows only on floating things (toolbox, menus, dialogs).
- The canvas paper is always white in every theme by default, because UML is read on white; a "dark paper" option exists; exports default to white or transparent.
- UML notation is drawn strictly: 1 px near-black lines on paper regardless of theme (2 px in high contrast), 12 px sans body text in nodes, italic for abstract, underline for static, guillemets for stereotypes. Nothing on the paper uses the accent colour except selection outlines, focus rings and connection previews.
- Selection is a 2 px solid accent outline with 6 px corner handles; keyboard focus is a 2 px dashed accent ring at 5 px offset; hover is a 1 px accent outline at 50%. Edges select by a 10 px invisible hit band.
- One accent (blue; yellow in high contrast), one warning (amber, for parse warnings), one danger (red, for delete). Nothing else is coloured in the chrome.

## Chrome tokens

| Token            | Modern dark  | Modern light | Classic       | High contrast | Use                                            |
| ---------------- | ------------ | ------------ | ------------- | ------------- | ---------------------------------------------- |
| `chrome.bg`      | #1A1A1F      | #F6F6F8      | #ECECEC       | #000000       | Bars, panels                                   |
| `chrome.surface` | #222229      | #FFFFFF      | #F7F7F7       | #0A0A0A       | Inputs, cards, inspector body                  |
| `chrome.border`  | #2F2F38      | #DCDCE3      | #C9C9C9       | #FFFFFF       | 1 px separators                                |
| `chrome.text`    | #ECECF1      | #1B1B22      | #1E1E1E       | #FFFFFF       | Primary text                                   |
| `chrome.muted`   | #9B9BA8      | #6B6B78      | #5F5F5F       | #E6E6E6       | Labels, hints                                  |
| `accent`         | #4F8CFF      | #2F6FE4      | #2F6FE4       | #FFD60A       | Selection, focus, primary button, active tool  |
| `on-accent`      | #FFFFFF      | #FFFFFF      | #FFFFFF       | #000000       | Text on accent                                 |
| `warning`        | #E0A33A      | #B8781A      | #B8781A       | #FFD60A       | Parse warnings                                 |
| `danger`         | #E5533D      | #C43A2C      | #C43A2C       | #FF6B5A       | Delete                                         |
| `paper.bg`       | #FFFFFF      | #FFFFFF      | #FFFFFF       | #FFFFFF       | Canvas                                         |
| `paper.grid`     | #E0E0E6 dots | #E0E0E6 dots | #E9E9E9 lines | none          | Grid                                           |
| `paper.ink`      | #1B1B1B      | #1B1B1B      | #1B1B1B       | #000000       | All UML strokes and text                       |
| `paper.fill`     | #FFFFFF      | #FFFFFF      | #FFFFE0       | #FFFFFF       | Class body; Classic uses StarUML's pale yellow |

Selection tint: accent at 8%. Focus ring: accent. Dim behind dialogs: black at 45%.

## Node metrics

Min width 160 px; compartment padding 6 px vertical, 10 px horizontal; name row 28 px with 13 px semibold text (40 px when a stereotype line is present); member rows 20 px with 12 px text; compartments separated by 1 px `paper.ink` lines; empty compartments collapse to 8 px. Packages: tab 24 px high and 40% of width, min 240×160. Notes: folded corner 12 px, min 120×60. Edge markers: arrowheads 12 px, diamonds 14×8 px, triangles 14 px, dashed pattern 6/4; `markerUnits="userSpaceOnUse"` so markers do not scale with stroke.

## Type

Chrome: system UI stack at 13 px. Paper: a bundled OFL font that renders identically on every lab machine so exports match across OSes; a humanist sans at 12 px. Monospace only in the Text view and the inline member editor.

## States every panel must render

- Canvas: empty workspace (hint `⌘N`), editing inline, connection in progress, relationship picker open, keyboard focus with narration.
- Inspector: nothing selected (collapsed), classifier, relationship, note, diagram defaults.
- Outline: empty, filtered with no matches, item selected, item renaming.
- Overlays: command palette, quick find, export sheet, unsaved-changes prompt, import notice, toasts.
