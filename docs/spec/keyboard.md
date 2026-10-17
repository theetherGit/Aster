# Keyboard and mouse model

Single-letter keys create and connect when the canvas has focus and nothing is being edited; modifier chords do file, format and view work everywhere; `⌘` is `Ctrl` on Windows and Linux, and the shortcut sheet shows whichever applies. Where StarUML already has a binding for the same action, Aster uses it, so nothing a StarUML user knows is wrong here; Aster's own additions sit beside them. **Never invent a binding; add it here first.**

| Key                                               | Action                                                                  | Notes                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `C` / `I` / `E` / `D` / `P` / `N`                 | New class / interface / enum / data type / package / note at the cursor | Name selected for typing                                                 |
| `L`                                               | Start a link from the selected node                                     | Arrow keys or click pick the target; `1`–`6` pick the kind               |
| `F2` or `↩` or double-click                       | Edit the selected element's text                                        | On a class: name; on a compartment line: that line (StarUML's QuickEdit) |
| `⌘↩` / `⌘⇧↩` while editing                        | Add attribute / add operation below                                     | StarUML's keys                                                           |
| `↩` while editing                                 | Commit and start the next line in the same compartment                  | On the last operation, `↩` on an empty line ends editing                 |
| `Tab` / `⇧Tab` while editing                      | Next / previous compartment                                             |                                                                          |
| `⌘↑` / `⌘↓`                                       | Move member up / down                                                   | Works in Outline too                                                     |
| `Esc`                                             | End editing; then clear selection; then close any panel                 | Progressive                                                              |
| `⌘A`                                              | Select all                                                              |                                                                          |
| `⌫` / `Delete`                                    | Delete from the diagram                                                 | View only, as StarUML                                                    |
| `⌘⌫`                                              | Delete from the model                                                   | Removes every view; undoable, no confirm                                 |
| `⌘E` / `⌘D`                                       | Select in Outline / select in diagram                                   | StarUML's keys                                                           |
| `⌘C` / `⌘X` / `⌘V` / `⌘⇧C`                        | Copy / cut / paste / copy diagram as image                              | Paste creates views, or model+views across projects                      |
| Arrows / `⇧` + arrows                             | Nudge selection 1 px / 8 px                                             |                                                                          |
| `⌘Z` / `⌘⇧Z`                                      | Undo / redo                                                             | `⌘Y` also redoes, for Windows hands                                      |
| `⌘N` / `⌘O` / `⌘S` / `⌘⇧S`                        | New / open / save / save as                                             |                                                                          |
| `⌘⇧E`                                             | Export sheet                                                            | `⌘E` is taken by StarUML's select-in-explorer                            |
| `⌘K` or `⌘⇧P`                                     | Command palette                                                         | StarUML's key kept as alias                                              |
| `⌘P`                                              | Quick find: elements, diagrams                                          | StarUML's key                                                            |
| `⌘F`                                              | Find in text view                                                       |                                                                          |
| `⌘\`                                              | Toggle the inspector (Modern) or Editors (Classic)                      |                                                                          |
| `⌘B`                                              | Toggle the Outline / Model Explorer                                     |                                                                          |
| `⌘=` / `⌘-` / `⌘0` / `⌘9`                         | Zoom in / out / to 100% / to fit                                        | `⌘1` also fits, for muscle memory                                        |
| `⌘⇧]` / `⌘⇧[`                                     | Next / previous diagram                                                 | StarUML's keys                                                           |
| `⌘G` / `⌘⇧G`                                      | Show grid / snap to grid                                                | StarUML's keys                                                           |
| `⌘L` / `⌘⇧B` / `⌘⌥L` / `⌘⌥B`                      | Line style: rectilinear / oblique / rounded / curve                     | StarUML's keys (`⌘B` is the Outline here, so oblique gets `⇧`)           |
| `⌘⇧V` / `⌘⇧Y` / `⌘⇧M` / `⌘⇧J` / `⌘⇧N`             | Show visibility / type / multiplicity / operation signature / namespace | StarUML's keys                                                           |
| `⌘⇧A` / `⌘⇧O` / `⌘⇧T`                             | Suppress attributes / operations / literals                             | StarUML's keys                                                           |
| `⌘⇧0` / `⌘⇧1`                                     | Stereotype display: none / label                                        | StarUML's keys; icon modes v0.2                                          |
| `⌘⇧R`                                             | Auto resize                                                             | StarUML's key                                                            |
| `⌘⇧L`                                             | Switch Modern / Classic layout                                          |                                                                          |
| `⌘⌥T`                                             | Toggle dark / light / high contrast                                     |                                                                          |
| `Space` + drag, middle-drag, or two-finger scroll | Pan                                                                     |                                                                          |
| `⌘` + scroll or pinch                             | Zoom at the cursor                                                      |                                                                          |
| `F6` / `⇧F6`                                      | Cycle focus between panels                                              |                                                                          |
| `⇧F10` or right-click                             | Context menu for the focused element                                    |                                                                          |
| `?`                                               | Shortcut sheet                                                          | Generated from the command registry                                      |

Classic layout additionally honours StarUML's `Ctrl+1`…`Ctrl+6` panel toggles (Sidebar, Navigator, Toolbar, Statusbar, Toolbox, Editors).

## Canvas keyboard model (M2)

The diagram is one Tab stop in the page; inside it, focus roves between elements. Arrow keys move focus to the nearest element in that direction (spatial navigation, not DOM order); `Tab` inside the diagram cycles the focused element's parts (name, then each compartment line, then each attached edge); `↩` edits, `Esc` steps back out; `⌘`+arrows nudge 1 px, `⌘⇧`+arrows 8 px; `⇧`+arrows resize packages and notes; `L` starts a link and arrows choose the target; `⌫` deletes with an undo toast rather than a confirm. The focused element shows a 2 px dashed focus ring distinct from the solid selection outline, and the viewport scrolls to keep it visible.

## Mouse

Click selects; `⇧`-click adds; drag on empty paper draws a marquee; drag a node moves it (with its package members if it is a package); drag a node's edge handle starts a connection; drag an edge's midpoint adds a waypoint; drag a waypoint onto a neighbour removes it; drag an end label repositions it; right-click opens a context menu with the same commands the palette has for that element. Resize handles appear on packages and notes, and on classes when hovered; classes otherwise auto-size to content. Edges select through a 10 px invisible hit band.

## Focus rules

The canvas is the default focus target. Clicking into a panel moves focus there and single-letter shortcuts stop firing until focus returns, so typing a class name never spawns classes.
