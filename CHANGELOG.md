# Changelog

## 0.1.0-preview.1 — M1 lab preview (unreleased)

The first public preview, for the OOAD lab on 24 Oct 2026. Class diagrams end to end, StarUML `.mdj` in and out.

### Added

- Class, interface, enumeration, data type and primitive type nodes with inline UML text editing (StarUML's grammar, `<<stereotype>>` included), type-name completion, and a parse chip under the node.
- Six relationship kinds with UML 2.5 markers, end labels, navigability and the ownership dot; four line styles; waypoints and label positions by drag or from the inspector; a self-association loop.
- Notes with note links, free text, and a Markdown documentation field with preview on every element.
- Display toggles with StarUML's keys: visibility, type, multiplicity, operation signature, namespace, property strings; hide attributes, operations, literals; stereotype none/label; auto resize. Per-diagram defaults with per-element overrides.
- `.mdj` import of every row in the mapping table, in a Web Worker, with an import notice; everything unmapped kept and written back. `.mdj` export equal to the source after a no-op load for all fifteen public fixtures.
- The native `.aster` format (the project as JSON, strictly validated), saved back in whichever format a file was opened as; an opened `.mdj` whose bytes match an autosave restores it with its undo history.
- Autosave to IndexedDB with undo history, Recent with thumbnails, File System Access save with a download fallback, three save states, the unsaved-changes prompt, a welcome screen and an empty-diagram hint.
- PNG (1× or 2×) and SVG export with the paper font embedded, white or transparent, whole or selection; copy as PNG.
- A command registry driving the keyboard, the `⌘K` palette and the `?` shortcut sheet; an Explorer tree with ARIA tree keyboard; a Properties inspector and a Diagram tab.
- Light and dark themes following the system with a remembered override; a unit test that keeps every token text pair at 4.5:1.
- Virtualised rendering above 100 nodes; a 200-class / 300-edge performance test.

### Known gaps

- The lab-version `.mdj` files are not yet in the fixture corpus; the owner's StarUML round-trip check is still to be run.
- Packages, object diagrams, the Text view, Classic layout, validation, high contrast and the PWA are M2 and M3 (see the README roadmap).
