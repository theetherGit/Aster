# Aster — Claude Code prompts

One prompt per Claude Code session, in order. Each is self-contained because every session starts with no memory of the last one; `CLAUDE.md` carries the standing rules between them.

**This folder is already in the repo** when you run Prompt 0, so Prompt 0 differs from a blank-directory bootstrap: it must not overwrite `CLAUDE.md`, `docs/spec/`, the two hand-authored type files, or `fixtures/`.

**What stays yours** (already written, read them line by line before Prompt 0 and change what you disagree with): `CLAUDE.md`, `src/lib/model/types.ts`, `src/lib/commands/types.ts`, `docs/manual-a11y-script.md`, `fixtures/grammar/lines.json` (add your 20 real lines before day 2), `fixtures/mdj/` (add the three lab files before day 4).

**The ritual per slice.** Paste the prompt. Let it plan; read the plan and cut anything from a later milestone. Let it write the tests named in the prompt first, confirm they fail for the right reason, then let it implement to green. Run the slice's acceptance criteria yourself, deploy, then run the review prompt at the end of this file before closing the session. Every deviation from the spec goes in `DECISIONS.md`.

Parts in `[brackets]` are placeholders only you can fill.

---

## Prompt 0 — Bootstrap

Run once, before day 1, in the repo that already contains this folder.

```
You are bootstrapping Aster, an open-source, browser-based UML class modeller that reads and writes StarUML .mdj files. This repository already contains CLAUDE.md, docs/spec/, docs/prompts.md, docs/manual-a11y-script.md, DECISIONS.md, src/lib/model/types.ts, src/lib/commands/types.ts and fixtures/. Read CLAUDE.md first, then docs/spec/overview.md, architecture.md and data-model.md. Do not modify, move or regenerate any of those files; the two types files are hand-authored and fixed. This session only sets up tooling; it builds no features.

Do the following:

1. Scaffold a SvelteKit project in place (keep the existing files) with Svelte 5 (runes), TypeScript strict, Vite, the static adapter, Tailwind, Vitest, Playwright, ESLint and Prettier. Package manager: pnpm. Node 22. Add @xyflow/svelte, elkjs, idb-keyval, nanoid and bits-ui (headless, Svelte 5). Bits UI is the only UI library: its primitives for menus, context menus, dialogs, popovers, tooltips, tabs, select, combobox, toggle groups and toolbars, styled with our own tokens; do not add shadcn-svelte or any styled kit.
2. Create the rest of the folder layout from CLAUDE.md: src/lib/{model,commands,mdj,puml,stores,canvas,panels,persist,i18n}, src/routes, tests/{unit,e2e}, fixtures/perf. Where a folder already has files, leave them.
3. Make $lib/model/types.ts and $lib/commands/types.ts type-check as they are (they import nothing but each other). If anything in them will not compile, tell me; do not edit them.
4. Set up: pnpm scripts for dev, build, preview, test, test:e2e, lint, format, check; a GitHub Actions workflow that runs lint, check, unit tests and e2e on push; Cloudflare Pages deployment config for the static build; .editorconfig; [MIT | Apache-2.0] licence file with my name [YOUR NAME]; a minimal README that says what Aster is and links docs/spec.
5. Add a PR template whose checklist mirrors the accessibility rules in CLAUDE.md and includes "manual script run by a human: yes/no/not applicable".
6. Make the first commit, run the full script set once to prove it is green, and tell me what you set up and anything you had to decide (put decisions in DECISIONS.md).
```

---

## M1 Day 1 — Model, commands, canvas, class node

```
Read CLAUDE.md, docs/spec/architecture.md, docs/spec/data-model.md and the Class node, Model/view split and Undo/redo rows of docs/spec/features.md. The model types in src/lib/model/types.ts and command types in src/lib/commands/types.ts are hand-written and fixed; build against them exactly. If a type is missing something you need, stop and propose the change.

Build, in this order, tests first for each:

1. src/lib/model: a Project store with id-keyed element maps; pure functions to create/read elements; a tiny factory for test fixtures. Unit tests.
2. src/lib/commands: the command stack implementing CommandStack from types.ts with apply/undo/redo, the UNDO_LIMIT cap, coalescing of consecutive CoalescingCommands with the same coalesceKey within coalesceMs (moves use 300 ms), and labels. Commands for this slice: addClassifier, renameClassifier, setClassifierFlags (abstract, visibility, stereotype), deleteFromDiagram, deleteFromModel, moveNode, resizeNode, addToDiagram. Each command is registered by id with a factory from its args so the stack can be serialised and restored. Write the property test from features.md: 50 random commands then undo all must restore a structurally equal model and layout.
3. src/lib/stores: project, layout, selection, ui (zoom, theme, layout preset, panel visibility) as Svelte 5 rune stores; derived flowNodes and flowEdges computed from project + layout only.
4. src/lib/canvas: a Svelte Flow instance with a dot-grid paper, pan/zoom, selection, marquee. A ClassNode component with three compartments (name row with optional «stereotype» line, italic when abstract; attributes; operations), min width 160, auto-size to content, empty compartments collapsed to 8 px, static members underlined. Use the tokens and metrics in docs/spec/ui.md exactly. Dragging a node dispatches moveNode; nothing writes to Svelte Flow state directly.
5. src/routes: the Modern layout shell from docs/spec/ui.md: 44 px top bar (project name, diagram tabs, undo/redo, zoom, Export button placeholder, palette button placeholder), floating toolbox top-left (Select, Class, Interface, Enum, Package, Link; only Class works today), right inspector placeholder, no explorer yet. Dark and light tokens via CSS variables; follow prefers-color-scheme.
6. Keyboard: C creates a class at the cursor with its name selected; Enter commits; Esc ends editing; arrows nudge 1 px, Shift+arrows 8 px; Backspace deletes from diagram, Cmd/Ctrl+Backspace deletes from model; Cmd/Ctrl+Z / Shift+Z undo/redo, Cmd/Ctrl+Y redo. Single-letter keys fire only when the canvas has focus and nothing is being edited.

Do not build: inline member editing (day 2), relationships (day 3), persistence, the explorer, the properties panel, Classic layout, or anything marked M2/M3.

Done when: unit tests and the undo property test pass; a class with 10 attributes and 10 operations renders without clipping; abstract shows italic; I can create, move, nudge, delete and undo with the keyboard only; pnpm build succeeds and the site deploys. Finish by listing what you built, what you left for day 2, and any DECISIONS.md entries.
```

---

## M1 Day 2 — Grammar, inline editing, explorer, properties

Before this session: `fixtures/grammar/lines.json` must hold at least 40 lines — the 20 shipped here plus 20 copied out of real StarUML `.mdj` `text` fields (UMLAttributeView / UMLOperationView `text`).

```
Read CLAUDE.md, the grammar and mapping sections of docs/spec/data-model.md, the Inline UML text editing, Interface/enum/data type nodes, Explorer/Outline and Properties panel rows of docs/spec/features.md, and the keyboard table in docs/spec/keyboard.md. fixtures/grammar/lines.json is the parser's truth; read its README first.

Build, tests first:

1. src/lib/mdj/expression.ts: parse and render for attribute, operation, literal and parameter lines per the grammar, including the <<stereotype>> prefix, {static}/{abstract} props, multiplicity, defaults and the property block. Parsing is forgiving about whitespace; rendering is canonical. Unparseable input returns { raw } and never throws. Every line in fixtures/grammar/lines.json must parse to its expected structure, and render(parse(line)) must equal the canonical form for valid lines.
2. Commands: addMember, setMemberText (parse on commit), reorderMember, deleteMember, setClassifierKind, setLiterals. Member edits that fail to parse still commit with raw text and a warning flag.
3. Inline editing on the canvas: F2 / Enter / double-click edits the name; double-click or Tab into a compartment edits a member line as text with a caret; Enter commits and opens a new line below (StarUML's Cmd/Ctrl+Enter also adds an attribute, Cmd/Ctrl+Shift+Enter an operation); Tab / Shift+Tab move between compartments; Cmd/Ctrl+Up/Down reorder; Esc ends editing. A thin warning underline on unparsed lines, with the parse summary shown in a small status chip under the node while editing (board 04 on the design canvas). Type-name completion from the project's classifiers.
4. InterfaceNode («interface», operations only by default), EnumNode («enumeration» + literals), DataTypeNode («dataType» / «primitive»). I, E and D keys create them. Shared compartment rendering with ClassNode; do not copy-paste the component.
5. Explorer drawer (240 px, Cmd/Ctrl+B): a read-only tree Project > Diagrams > Packages > Classifiers > members > relationships, role="tree" with roving tabindex and the ARIA tree keyboard (Up/Down, Left/Right collapse/expand, Home/End, type-ahead). Hand-built, not a Bits UI primitive. Selection is bidirectional with the canvas. Cmd/Ctrl+E selects the canvas element in the tree; Cmd/Ctrl+D the reverse. Editing from the tree is M2; do not add it.
6. Inspector, Properties tab (Bits UI Tabs): form fields for the selection (name, stereotype, visibility, abstract, leaf; members as a list with add/remove/reorder; for enums, literals). Every field dispatches the same commands as inline editing; changing visibility in the panel updates the compartment text within one frame.
7. i18n: every visible string in this slice goes through src/lib/i18n with an en.json; add a pseudo-locale that wraps strings in brackets and lengthens them by 30%, switchable by a URL param, for layout testing.

Do not build: relationships, persistence, Classic layout, outline editing, the text view.

Done when: the grammar fixture test is green; the four node kinds render and round-trip through commands; the keyboard flow in the prompt works with no mouse; the explorer tree passes the ARIA tree keyboard checks in a Playwright test; pnpm build and deploy succeed. List DECISIONS.md entries.
```

---

## M1 Day 3 — Relationships

```
Read CLAUDE.md, the Relationship and End types in docs/spec/data-model.md, the Six relationships, Line styles and Relationship picker rows of docs/spec/features.md, the UML notation rules in docs/spec/ui.md, and the keyboard table. Boards 01 and 05 on the design canvas show the target rendering and the picker.

Build, tests first:

1. Commands: connect(sourceId, targetId, kind), setRelationshipKind, setEnd (role, multiplicity, navigable, visibility), setRelationshipName, setLineStyle, addWaypoint, moveWaypoint, removeWaypoint, deleteFromDiagram/deleteFromModel for relationships. Aggregation and composition store the diamond side as the relationship's target per types.ts; connecting part to whole is the gesture.
2. Edge components in src/lib/canvas/edges: one base edge with SVG marker defs rendered once per diagram (hollow triangle, filled diamond, hollow diamond, open arrow), stroke per ui.md in paper.ink, dash 6/4 for realization and dependency, markerUnits userSpaceOnUse so markers do not scale with stroke. Association shows an open arrow at a navigable end only when the other end is not navigable; both navigable draws no arrows. Ownership dot when End.ownsOther. Dependency shows «use» or its stereotype as a mid-label when set.
3. End labels: multiplicity and role at each association end, offset perpendicular from the line, draggable with the offset stored in EdgeLayout.labelOffsets; name label at the midpoint. Labels never sit on their own line.
4. Routing: straight by default; user waypoints by dragging the edge midpoint; drag a waypoint onto a neighbour to remove it; the four StarUML line styles (rectilinear, oblique, roundrect, curve) selectable per edge with Cmd/Ctrl+L, Cmd/Ctrl+Shift+B, Cmd/Ctrl+Alt+L, Cmd/Ctrl+Alt+B; a self-association renders as a readable loop on the node's top-right. Edges select through a 10 px invisible hit band.
5. Relationship picker (Bits UI Popover): on connection drop, at the drop point, listing the six kinds with their glyphs and 1–6 keys, remembering the last choice as default (board 05). Keyboard flow: select a node, press L, arrows move a target highlight between nodes, Enter opens the picker, a number creates the edge, Esc cancels at any step.
6. Inspector for a selected edge: kind, name, line style, and for association kinds both ends (role, multiplicity, navigability, visibility).
7. Explorer shows relationships under their source classifier.

Do not build: association classes, qualifiers, n-ary, note links (day 6), persistence.

Done when: a Playwright test creates all six kinds keyboard-only and asserts the DOM markers; a visual regression snapshot of a fixture diagram matches UML 2.5 notation (I will eyeball it against the spec figures); labels remain legible at 50% zoom; the undo property test still passes with the new commands added to its generator. List DECISIONS.md entries.
```

---

## M1 Day 4 — `.mdj` import

Before this session: `fixtures/mdj/` holds the three lab files plus at least five public `.mdj` files from GitHub (search `filename:.mdj UMLClassDiagram`). Without fixtures this day cannot start.

```
Read CLAUDE.md, the whole mapping table in docs/spec/data-model.md, fixtures/mdj/README.md, and the .mdj import/export row of docs/spec/features.md. The fixtures in fixtures/mdj/ are the truth; read two of them end to end before writing any code so you have seen the real shapes, including subViews, EdgeLabelView, $ref and _parent.

Build, tests first:

1. src/lib/mdj/parse.ts: parseMdj(json): { project, report } implementing every row of the mapping table, filling Project.unknown and Project.importedIds from types.ts. Walk the tree once, index by _id, resolve $ref lazily. Everything not in the table becomes an Unknown with its parent id, array path and index, byte-identical to the source. Multiple UMLClassDiagrams become multiple Diagrams. Views without a resolvable model, or models without views, are kept (model) or dropped with a warning (view).
2. View import: left/top/width/height, fillColor, lineColor, the show*/suppress*/stereotypeDisplay flags, lineStyle 0–3, points to waypoints (dropping the two border endpoints), EdgeLabelView alpha/distance into labelOffsets, containerView into package membership.
3. A parse report: counts of what was placed, and a list of diagram types that were kept but not shown (for the import notice on board 08).
4. Run the parser in a Web Worker so a 10 MB file does not block the UI; the main thread gets the result and the report.
5. Open flow: Cmd/Ctrl+O file picker (File System Access API when available, <input type=file> fallback), drag-and-drop anywhere on the window, and a Recent list stub (full recents is day 5). After opening, the first class diagram is active and the notice (Bits UI Dialog) shows the report.
6. Tests: for every fixture, parse succeeds, every UMLClassView has a NodeLayout, every edge view has an EdgeLayout, the number of Unknowns is reported, and a snapshot of the parsed model is stored so regressions show as diffs. Add unit tests for each mapping row using minimal hand-written JSON.

Do not build: export (day 5), fragments, anything that edits what was imported beyond what already works.

Done when: all fixtures open with every class at its StarUML position and every relationship intact (I will compare against StarUML screenshots); the worker path is used; the notice lists kept-but-hidden diagrams; mapping-row unit tests are green. Record in DECISIONS.md any field you found in the fixtures that the mapping table does not mention, with what you did with it.
```

---

## M1 Day 5 — `.mdj` export, image export, autosave, files

```
Read CLAUDE.md, the Export rules in docs/spec/data-model.md, and the .mdj import/export, PNG/SVG export, Autosave/recents/files and Undo/redo rows of docs/spec/features.md. Board 06 on the design canvas is the export sheet.

Build, tests first:

1. src/lib/mdj/serialize.ts: serializeMdj(project): json. Ids in project.importedIds are kept; new elements get 22-char base64url ids; _parent is always written; associations live in the end1 class's ownedElements, generalizations/realizations/dependencies in the source's; every classifier view gets regenerated UMLNameCompartmentView, UMLAttributeCompartmentView, UMLOperationCompartmentView (and literal compartment for enums) with UMLAttributeView/UMLOperationView children whose text is the canonical rendered line; edge points are rewritten with border endpoints recomputed from the current layout; Unknowns are spliced back at their recorded parent, path and index.
2. The golden test: for every fixture, parse then serialize must equal the source JSON ignoring key order and whitespace. Where it cannot (document the reason), the diff must be limited to regenerated subview geometry. Then a mutation test: parse, rename one class, serialize, parse again: only that name changed.
3. Save flow: Cmd/Ctrl+S writes back to the opened file handle through the File System Access API, else downloads; Cmd/Ctrl+Shift+S saves as. The native format is .aster (docs/file-format.md): src/lib/aster with serializeAster/parseAster (Map/Set to JSON and back, zod schema mirroring types.ts, version 1), the picker accepts .mdj/.aster/.aster.json, Cmd/Ctrl+S writes the format the file was opened as, and an opened .mdj whose content hash matches the autosave entry's origin.sourceHash restores that entry instead of re-parsing. Unsaved-changes dot in the top bar and a beforeunload guard. Document title shows the file name.
4. Autosave: every change debounced 300 ms into IndexedDB via idb-keyval, keyed by project id, storing model + layout + CommandStack.snapshot(); on load, restore the last project and its stack; the Recent list on the welcome screen (board 07) from the last 10 projects with a thumbnail rendered at save time.
5. Export sheet (Cmd/Ctrl+Shift+E, Bits UI Dialog, board 06): PNG or SVG; 1x or 2x; white or transparent; whole diagram or selection; file name defaults to the diagram name; Copy to clipboard as PNG (Cmd/Ctrl+Shift+C also copies, as in StarUML). Use Svelte Flow's toPng/toSvg helpers; the paper grid is never exported; the bundled paper font is embedded in the SVG.
6. Welcome screen: New diagram, Open .mdj, Recent; the sample diagram is [the lab exercise: describe it or point to a fixture].

Do not build: fragments, PDF, Mermaid, the PWA.

Done when: golden and mutation tests are green for all fixtures; I open an exported file in StarUML [version], move one class, save, reopen in Aster and nothing else changed; a 2x PNG of a 20-class diagram is sharp and under 2 MB; closing the tab mid-edit and reopening loses nothing, including undo history. List DECISIONS.md entries.
```

---

## M1 Day 6 — Palette, display toggles, notes, themes, performance

```
Read CLAUDE.md, the Command palette, Display toggles, Notes and text, Modern layout and Performance rows of docs/spec/features.md, the keyboard table, and the tokens in docs/spec/ui.md.

Build, tests first:

1. Command registry: every command in the app registered once with id, label, shortcut, context and handler; the keyboard router, the palette and (later) menus all read the registry. Adding a command must never require touching the palette. Shortcuts exactly as docs/spec/keyboard.md; Cmd on macOS, Ctrl elsewhere; the shortcut sheet (?) is generated from the registry.
2. Command palette (Bits UI Command/Combobox in a Dialog): Cmd/Ctrl+K (alias Cmd/Ctrl+Shift+P), fuzzy filter over labels, shows shortcuts, Up/Down/Enter/Esc, dispatches into the focus context that was active before it opened.
3. Display toggles with StarUML's keys: show visibility / type / multiplicity / operation signature / namespace / property (Cmd/Ctrl+Shift+V/Y/M/J/N/P); suppress attributes / operations / literals (Cmd/Ctrl+Shift+A/O/T); stereotype display none/label (Cmd/Ctrl+Shift+0/1); auto resize (Cmd/Ctrl+Shift+R). Per-diagram defaults (Diagram.defaults) in the inspector's Diagram tab, per-element overrides (NodeLayout.flags) on the selection, both written to the matching view flags on export.
4. Notes and text: N creates a note; a note can be linked to any element with L (dashed note link, no arrowhead); free text element; both editable inline and round-tripped to UMLNoteView / UMLNoteLinkView / UMLTextView. The Markdown documentation field on every element in the Properties tab, with preview, stored in `documentation`.
5. Themes: dark and light from the token table, system-following with an override remembered; the paper stays white in both; Cmd/Ctrl+Alt+T cycles. Every text pair passes 4.5:1: add an automated contrast test over the token table.
6. Performance: enable Svelte Flow's onlyRenderVisibleElements; memoise text measurement per (text, font); generate fixtures/perf/large.mdj with 200 classes and 300 edges and a Playwright test that pans it for 3 s and asserts the mean frame time under 16.7 ms on the CI runner (or document the runner's baseline). First paint under 1 s on a throttled 4x CPU profile.
7. Welcome screen polish (board 07) and the status footer (classifier/relationship counts, autosave time).

Do not build: Classic layout, the text view, outline editing, validation (all M2).

Done when: every shortcut in docs/spec/keyboard.md marked M1 works and appears in the sheet; toggles round-trip to .mdj flags; notes round-trip; the contrast test and the perf test are green; the full M1 exit criteria in docs/spec/milestones.md are checked. List DECISIONS.md entries.
```

---

## M1 Day 7 — Buffer, rehearsal, preview release

No features today. Use this prompt only after you have done the lab exercise yourself in Aster twice and written down everything that annoyed you.

```
Read CLAUDE.md. This is the buffer day before the first public preview; no new features. Here is my list from rehearsing the lab exercise end to end twice: [paste your notes: bugs, rough edges, anything that made you reach for the mouse].

Do the following:

1. Fix the list above, smallest-risk first; each fix is its own commit with a test where one is possible.
2. Run the full test suite, lint, check and e2e; fix anything red.
3. Write the README properly: what Aster is, the three-sentence pitch, a screenshot of board 01 [I will add the image], how to use it (open a .mdj, do the lab, save, export), the keyboard essentials, the roadmap taken verbatim from docs/spec/overview.md with the milestone dates, a StarUML compatibility note that links docs/spec/parity.md, how to contribute, the licence.
4. Write CONTRIBUTING.md (setup, tests, the model-as-source-of-truth rule, the accessibility rules, how to add a command) and a CHANGELOG.md with a 0.1.0-preview.1 entry.
5. Add GitHub issue templates (bug, .mdj compatibility report with a file attachment field, feature).
6. Tag v0.1.0-preview.1, confirm the deploy at [URL] serves it, and give me a one-paragraph summary I can post with the link.

Do not touch anything in the M2 or M3 lists, even if a fix would be easy.
```

---

## M2 — Accessible preview (25 Oct – 7 Nov)

Seven slices, roughly two days each, in this order. Every slice ends with **you** running `docs/manual-a11y-script.md` on the part it touched.

### M2.1 — Canvas keyboard model and focus

```
Read CLAUDE.md and docs/spec/accessibility.md (the Canvas keyboard model section is the contract) plus the keyboard table. Board 10 on the design canvas shows the focus ring and the narration bar.

Build, tests first (Playwright, keyboard-only):

1. The diagram is one Tab stop in the page; inside it, focus roves between elements with a single tabindex=0 owner. Arrow keys move focus to the nearest element in that direction by centre-to-centre distance weighted toward the axis (spatial navigation); Tab inside the diagram cycles the focused element's parts (name, each member line, each attached edge) and Shift+Tab reverses; Esc steps back out one level, then clears selection, then leaves the diagram.
2. Focus ring: 2 px dashed in the accent colour with 5 px offset, distinct from the solid selection outline; the viewport scrolls to keep the focused element in view; focus is never removed by a re-render (stable element ids).
3. Every action from the keyboard table works from the focused element: Enter edits, L links (arrows pick the target, Enter confirms, 1–6 pick the kind), Cmd/Ctrl+arrows nudge 1 px, Cmd/Ctrl+Shift+arrows 8 px, Shift+arrows resize packages and notes, Backspace deletes with an undo toast and no confirm.
4. F6 / Shift+F6 cycle focus between Explorer, canvas, Inspector and (later) Text view; each panel has a visually hidden skip link as its first focusable.
5. Pointer parity: every interactive target at least 24 by 24 CSS px (audit the existing ones and fix); a context menu (Bits UI ContextMenu) on right-click and Shift+F10 with the same commands as the palette for that element.

Done when: the lab exercise fixture can be built from an empty diagram with the mouse unplugged in a recorded Playwright test; axe reports no violations on the canvas page; focus never lands on a non-interactive element.
```

### M2.2 — Live announcements

```
Read docs/spec/accessibility.md, the Announcements section. Build one polite aria-live region and one assertive region mounted once at the app root. Every command's label (the same string the undo toast uses) becomes an announcement on apply, undo and redo, phrased for a listener: "Class Book created", "Loan connected to Book, association, one to many", "Moved Member 8 pixels right", "Undo: delete Account". Focus moves announce the element's summary: kind, name, member counts, attached relationships in plain language (board 10). Errors go to the assertive region. Add a captions toggle in settings that renders the live region visibly as the narration bar on board 10. Unit-test the phrasing with a table of commands to expected sentences; do not let the strings be built by concatenation in components; they come from i18n message functions.
```

### M2.3 — Outline as a full editing surface

```
Read the Three views, one model section of docs/spec/accessibility.md and the Explorer/Outline row of docs/spec/features.md. Extend the read-only tree from M1 so that every model edit is possible from it: rename inline (F2), add child (Cmd/Ctrl+Enter adds a sibling, Cmd/Ctrl+Shift+Enter a child of the right kind), delete (Backspace from diagram, Cmd/Ctrl+Backspace from model), reorder with Cmd/Ctrl+Up/Down and drag, create a relationship from a classifier's context menu with a target picker that is itself a searchable listbox (Bits UI Combobox), edit a member line as text directly in the tree row. All of it dispatches the same commands as the canvas. The tree stays an ARIA tree; the per-row editor is a proper <input>. Done when a screen-reader user can complete the lab exercise from the Outline alone, verified by the manual script (which I run, not you).
```

### M2.4 — Text view (PlantUML dialect)

```
Read the Text view dialect section of docs/spec/accessibility.md and the Text view row of docs/spec/features.md. Board 09 shows the pane. Build src/lib/puml: a parser and printer for the PlantUML class-diagram subset Aster models (class/abstract class/interface/enum, members with visibility and types, the six relationship arrows with multiplicity and labels, packages, notes), where lines it cannot model become preserved comments. The inspector's Text tab is a CodeMirror 6 editor (ask before adding the dependency; it is approved for this slice) with the dialect's syntax highlighting, inline error markers, and a status line (in sync / n errors). Bidirectional: model changes re-print the text preserving the user's ordering and blank lines where possible; text edits parse on a 250 ms debounce and apply as commands (one undo step per parse). .puml import and export via the file menu. Tests: a corpus of PlantUML class snippets from the PlantUML docs round-trips; every canvas command is reflected in the text; the editor is reachable with F6 and is fully keyboard operable.
```

### M2.5 — High contrast, reduced motion, pointer rules

```
Read the Visual and Pointer sections of docs/spec/accessibility.md and board 11. Add the high-contrast theme from the tokens in docs/spec/ui.md (2 px ink on the paper, yellow accent with black-on-yellow primaries, white 1 px chrome edges), make it follow forced-colors: active automatically and selectable manually; honour prefers-reduced-motion by removing every transition and the smooth zoom; verify 3:1 on all UI edges and 4.5:1 on all text in all three themes with the automated contrast test; make the UI reflow at 200% browser zoom with no horizontal scroll in panels. Done when axe and the manual WCAG 2.2 AA checklist pass in all three themes (the manual part is mine).
```

### M2.6 — Classic layout and validation panel

```
Read the Classic layout section of docs/spec/ui.md, board 03, and the Validation panel row of docs/spec/features.md. Build the Classic preset as an arrangement of the existing panels: menu bar (Bits UI Menubar: File, Edit, Format, Model, View, Help, generated from the command registry), 36 px toolbar (Bits UI Toolbar), left column with Working Diagrams over Toolbox, right column with Model Explorer over Editors (Style / Property / Documentation tabs), grey chrome tokens, line grid, pale-yellow class fill, StarUML's Ctrl+1–6 panel toggles. Switching layouts (Cmd/Ctrl+Shift+L) preserves selection, zoom and unsaved state. Then the validation panel: StarUML rules UML001–012 evaluated on every model change in a worker, listed in a bottom panel with jump-to-element, never blocking save; a fixture per rule that triggers it and one that does not.
```

### M2.7 — i18n, axe in CI, M2 audit

```
Move every remaining visible string into src/lib/i18n (grep for template text and literals in components); add the locale switcher; make the pseudo-locale a Playwright run that screenshots every panel and fails on clipped text. Add axe-core to the e2e suite for every route and panel state. Then produce docs/accessibility-audit.md: the WCAG 2.2 AA checklist with a pass/fail and evidence per criterion, and a list of what I must verify by hand (docs/manual-a11y-script.md). Do not mark anything as passing that only you have checked. Tag v0.1.0-preview.2.
```

---

## M3 — v0.1 release (8 – 21 Nov)

Six slices. The first two touch the model and the codec, so re-read the mutation and golden tests before each.

### M3.1 — Packages with containment

```
Read the Packages with containment row of docs/spec/features.md and the UMLPackage / containerView rows of the mapping table. Make Package a real container: nested packages, members move with their package on drag and keyboard nudge, qualified names (Shop::Order) in the Outline and in namespace display, .mdj export nests ownedElements and writes containerView on member views, import reverses it. The Outline shows the hierarchy; dragging a classifier between packages in the Outline is a moveToPackage command. Golden tests must stay green; add a fixture with two levels of packages and a class inside each.
```

### M3.2 — Object diagrams

```
Read the Object diagrams row of docs/spec/features.md. Add Instance (classifier ref, name, slots as name=value lines) and Link (between instances, optional association ref) to the model: propose the additions to src/lib/model/types.ts first and wait for my approval, since it is hand-authored. Then: an object diagram type with its own tab, InstanceNode rendering as name : Classifier underlined with a slots compartment, Link edges, creation from the toolbox and from a classifier's context menu ("New instance"), and .mdj round-trip to UMLObjectDiagram / UMLObject / UMLSlot / UMLLink and their views. Fixtures and golden tests as before.
```

### M3.3 — Auto-layout and tidy tools

```
Read the Auto-layout and tidy row of docs/spec/features.md. Integrate elkjs in a worker: layered and orthogonal algorithms, four directions, run on the whole diagram or the selection, applied as a single undoable command that moves nodes and rewrites waypoints. Add align left/right/top/bottom/middle/centre, distribute horizontally/vertically, same width/height/size, bring to front/send to back, grid and snap (Cmd/Ctrl+G, Cmd/Ctrl+Shift+G), all from the registry so they appear in the palette and the Classic Format menu. Done when a 100-class fixture with no layout lays out readably in under a second and every tool is keyboard-reachable.
```

### M3.4 — Exports: Mermaid, PDF, fragments, colours

```
Read the Mermaid export, PDF export, Fragments and Fill and line colour rows of docs/spec/features.md. Build: Mermaid classDiagram export from the model (verify a sample renders on mermaid.live); vector PDF export of the diagram or selection with page size and orientation options using the SVG pipeline; .mdj fragment import (File > Import > Fragment) as a child of the selected package; per-element fill and line colour in the inspector's Style section, written to fillColor / lineColor and imported from them. Keep the export sheet as one place with tabs rather than separate dialogs.
```

### M3.5 — PWA and performance pass

```
Read the PWA and Performance rows of docs/spec/features.md. Make Aster installable: manifest, icons, a service worker that precaches the build and serves it offline, an update prompt when a new build is available, and an airplane-mode Playwright test that opens a recent project, edits, saves and exports. Then the performance pass: profile the 500-classifier / 800-edge fixture, virtualise the Outline, make sure parsing and layout stay in workers, and reach 60 fps pan on the CI baseline and a 10 MB .mdj open under 2 s. Report before/after numbers in DECISIONS.md.
```

### M3.6 — Docs site, templates, release

```
Read the Docs and templates row of docs/spec/features.md. Build the docs site as a second SvelteKit route group or a separate static site under docs/ (your call, say why): a five-minute tour with screenshots, the keyboard reference generated from the command registry, the accessibility statement from docs/accessibility-audit.md, the .mdj compatibility notes, the StarUML parity page from docs/spec/parity.md, and the contributor guide. Add the template gallery to the welcome screen (library, e-commerce, hospital, ATM; I will supply the .mdj files). Update README and CHANGELOG, tag v0.1.0, confirm the deploy, and write the release notes.
```

---

## End-of-slice review

Paste in the same session after a slice reports done, before you deploy. It is deliberately adversarial.

```
Before we close this slice, review your own work as a hostile reviewer would. Read the diff since the last tag and answer in a table, one row per finding, with file and line:

1. Any place Svelte Flow state or a store is mutated outside a command.
2. Any interactive element that is not a real <button>, <a>, <input>, <select> or <textarea>; any role or onClick on a div or span; any icon-only control without an aria-label; any target under 24 by 24 CSS px; any drag without a keyboard or menu equivalent; any outline: none without a replacement focus style; any menu, dialog, popover, tooltip, tabs or combobox hand-rolled instead of built on Bits UI.
3. Any user-visible string not going through i18n.
4. Any keyboard binding not in docs/spec/keyboard.md, or one from the spec that is missing.
5. Any feature from a later milestone that crept in.
6. Any test that asserts on implementation details rather than the acceptance criteria, and any acceptance criterion in this slice's prompt with no test.
7. Anything you decided that is not in DECISIONS.md.

Fix items 1–4 now; list 5–7 for me to decide. Then run the full suite and report.
```
