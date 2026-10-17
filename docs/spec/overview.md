# Aster — Overview, goals, roadmap

Aster is a free, open-source UML class modeller that runs in the browser, keeps everything on the user's machine, and reads and writes StarUML's `.mdj` format so a class can switch to it mid-semester without losing a single file.

It is built for anyone who draws UML and is tired of paying for or pirating a desktop tool: students and teachers first, because that is where the need is sharpest, but also developers documenting a design, people writing a thesis, and anyone who needs a diagram tool that works with a keyboard and a screen reader. Aster is a product, not a class project: the first release does class diagrams completely, is accessible end to end, and treats every later diagram type as the same model with a new renderer.

**One app, two layouts.** Aster ships with a _Modern_ layout as the default and a _Classic_ layout that arranges the same panels the way StarUML does. Both are presets over one set of components: the same canvas, explorer, property panel, shortcuts and file handling. Classic exists so a classmate who has only ever used StarUML can open Aster and know where everything is; Modern is where the better experience lives. Switching is one toggle and is remembered. Only layout and chrome differ; no feature is exclusive to either.

**Why a web app.** The audience already has a browser and no admin rights on lab machines. It deploys as a static site, works offline after first load, and SvelteKit plus Svelte Flow lets the effort go into the UML parts instead of a canvas engine.

"Aster" is a working name.

## Goals and non-goals

v0.1 is a release other people can adopt, not a demo: it ships when a stranger can model a system with it, hand the `.mdj` to a StarUML user, and a blind user can do the same work through the outline and text views. The OOAD lab on 24 Oct 2026 is the first milestone on the way there, not the finish line.

### v0.1 release goals

- **Class diagrams, complete.** Classes, interfaces, enumerations, data types, packages with real containment, object diagrams (instances of the same model); all six relationships with ends, multiplicities, roles, navigability and the ownership dot; qualifiers, association classes and templates round-trip but are not editable until v0.2.
- **StarUML's editing model, kept.** Model and view are separate: `Delete` removes from the diagram, `⌘⌫` from the model; one element can appear in many diagrams; `⌘E` / `⌘D` jump between canvas and Outline; the member expression grammar is a superset of StarUML's, `<<stereotype>>` prefix included.
- **Three equivalent views of one model.** Canvas, Outline (an editable tree) and Text (a PlantUML-compatible class dialect that round-trips). Any edit in one appears in the others; a screen-reader user can do everything in Outline and Text.
- **Annotation and documentation.** Notes with note links, free text, and a Markdown documentation field on every element with preview.
- **Display control.** Show or hide visibility, type, multiplicity, operation signature, namespace and properties; suppress attributes, operations and literals; stereotype as label or none; all four StarUML line styles (rectilinear, oblique, rounded, curve), mapped to `.mdj` exactly.
- **Validation.** StarUML's eleven class-diagram rules (UML001–012) as a live, non-blocking warnings panel with jump-to-element.
- **Accessible end to end.** WCAG 2.2 AA; every action keyboard-reachable; spatial keyboard navigation on the canvas; live-region announcements; high-contrast theme; reduced motion; targets 24 px or larger; every drag has a non-drag equivalent.
- **Interoperable.** Open and save StarUML `.mdj` with round-trip fidelity and preservation of unknowns; import fragments; export PlantUML, Mermaid, SVG, PNG, PDF and copy-as-image; import PlantUML class syntax.
- **Local-first and offline.** Installable PWA, IndexedDB autosave, File System Access with fallback, recents with thumbnails, templates on new, no account, no telemetry.
- **Fast.** 60 fps pan and zoom with 500 classifiers and 800 edges; first paint under 1 s; virtualised canvas and outline.
- **Two layouts, three themes.** Modern and Classic layouts; light, dark and high-contrast themes; system-following by default; Classic honours StarUML's shortcuts.
- **Auto-layout and tidy tools.** Layered and orthogonal auto-layout (ELK) in four directions, align, distribute, same size, front/back, grid and snap.
- **Undo everything.** 500 steps across model, layout and view changes; named steps; persisted with the autosave so a reload keeps the stack.
- **Translatable.** Every string externalised; English shipped; RTL-safe layout; community translations without a code change.
- **Documented.** A docs site with a five-minute tour, the keyboard reference, the `.mdj` compatibility notes, the StarUML parity table and a contributor guide.

### Roadmap after v0.1

Each is the same model plus a renderer and a text dialect.

- v0.2: use case and package diagrams; XMI 2.x export; templates gallery; editable tags, constraints, association classes, qualifiers, templates; stereotype icon display (lollipops); HTML docs; minimap; CLI export.
- v0.3: sequence and state machine diagrams; `.mdj` fragments export; PlantUML sequence dialect.
- v0.4: activity, component and deployment diagrams; code generation plug-ins (TypeScript, Java, Python skeletons).
- v0.5: real-time collaboration over a self-hostable relay; comments; version history.
- Not planned: accounts as a requirement, cloud-only storage, telemetry, a mobile authoring layout (viewing on mobile is in scope from v0.2), SysML/ERD/BPMN and the other non-UML notations.
