# Architecture

SvelteKit (static adapter, Svelte 5 runes) on Cloudflare Pages, Svelte Flow (`@xyflow/svelte`) for the canvas, Tailwind for chrome, Bits UI for headless primitives, `idb-keyval` for autosave, `elkjs` for layout. No server, no accounts, no analytics.

## The rule

**The UML model is the source of truth and Svelte Flow is a projection of it.** Nodes and edges are derived from the model plus a layout map; every user action is a command that mutates the model and returns its inverse; the projection re-derives. This is what makes undo/redo, `.mdj` round-tripping, the three views and the two layouts cheap: none of them touch the canvas library directly.

```
Panels and shell ──dispatch──▶ Commands ──mutate──▶ UML model + layout ◀──open/save──▶ .mdj codec
     ▲                             │                      │                                 ▲
     └──────replay─────── Undo stack (inverses)           │ derive                          │ autosave
                                                          ▼                                 │
Canvas gestures ──as commands──▶ Svelte Flow projection (derived nodes/edges)      Persistence
```

## Layers

| Layer        | Lives in             | Owns                                                                                                                                                                                                                           |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Model        | `src/lib/model/`     | `Project`, `Diagram`, `Classifier` (class / interface / enum / dataType), `Attribute`, `Operation`, `Parameter`, `Relationship`, `End`, `Package`, `Note`, `Text`; pure TypeScript, no Svelte imports; unit-tested             |
| Commands     | `src/lib/commands/`  | One function per user action (`addClassifier`, `renameClassifier`, `setMemberText`, `connect`, `moveNode`, `deleteFromDiagram`, `deleteFromModel` …); each returns an inverse; the undo stack is a list of these               |
| Codec        | `src/lib/mdj/`       | `parseMdj(json) → { project, layout, unknown[] }` and `serializeMdj(project, layout, unknown) → json`; the expression grammar for member lines                                                                                 |
| Text dialect | `src/lib/puml/` (M2) | PlantUML class-diagram subset parser and printer, bidirectional with the model                                                                                                                                                 |
| Stores       | `src/lib/stores/`    | `project` (model), `layout` (positions, sizes, waypoints, label offsets keyed by element id), `selection`, `ui` (layout preset, theme, panel visibility, zoom); derived `flowNodes` and `flowEdges`                            |
| Canvas       | `src/lib/canvas/`    | Svelte Flow instance; node components (`ClassNode`, `InterfaceNode`, `EnumNode`, `DataTypeNode`, `PackageNode`, `NoteNode`, `TextNode`); edge components with SVG markers and end labels; connection handles; focus management |
| Panels       | `src/lib/panels/`    | Explorer/Outline tree, Inspector (Properties / Text / Diagram / Style), Toolbox, command palette, quick find, dialogs, validation panel; each reads stores and dispatches commands, never mutates the model                    |
| Shell        | `src/routes/`        | The two layout presets as two arrangements of the same panels; theme; keyboard router; command registry                                                                                                                        |
| Persistence  | `src/lib/persist/`   | IndexedDB autosave (debounced 300 ms, includes the undo stack), recents with thumbnails, File System Access API with download fallback                                                                                         |

## Workers

`.mdj` parsing, validation rule evaluation and ELK layout run in Web Workers. The main thread only ever applies results as commands.

## Command registry

Every command is registered once (id, label, shortcut, context, handler). The keyboard router, the command palette, the Classic menu bar, context menus and the shortcut sheet all read the registry. Adding a command never requires touching any of them.
