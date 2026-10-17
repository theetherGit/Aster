# Accessibility

The standard is WCAG 2.2 AA with one rule above it: anything a mouse user can do, a keyboard user can do as fast, and a screen-reader user can do at all. Diagram tools almost never meet that bar, which is why it is the thing that makes Aster worth existing beyond a free StarUML.

## Three views, one model

The canvas is one projection of the model; the Outline tree and the Text view are two more, and all three are complete editing surfaces. A screen-reader user never has to touch the canvas: every create, rename, connect, reorder and delete exists in the Outline (a proper `role="tree"` with the ARIA Authoring Practices keyboard) and in the Text view (type PlantUML, the model updates). The canvas exposes its state to assistive tech through those views rather than through hundreds of positioned ARIA nodes.

## Canvas keyboard model

The diagram is one focus stop in the page's Tab order; inside it, focus roves between elements (one `tabindex="0"` owner). Arrow keys move focus to the nearest element in that direction by centre-to-centre distance weighted toward the axis; `Tab` inside the diagram cycles the focused element's parts (name, each compartment line, each attached edge), `⇧Tab` reverses; `↩` edits, `Esc` steps back out one level, then clears selection, then leaves the diagram; `⌘`+arrows nudge 1 px, `⌘⇧`+arrows 8 px; `⇧`+arrows resize packages and notes; `L` starts a link and arrows choose the target; `⌫` deletes with an undo toast rather than a confirm. The focused element shows a 2 px dashed focus ring in the accent colour with 5 px offset, distinct from the solid selection outline; the viewport scrolls to keep it visible; focus is never lost to a re-render (stable element ids). `F6` / `⇧F6` cycle between Explorer, canvas, Inspector and Text view; every panel has a visually hidden skip link as its first focusable.

## Announcements

One polite `aria-live` region and one assertive region, mounted once at the app root. Every command's label (the same string the undo toast uses) becomes an announcement on apply, undo and redo, phrased for a listener: "Class Book created", "Loan connected to Book, association, one to many", "Moved Member 8 pixels right", "Undo: delete Account". Focus moves announce the element's summary: kind, name, member counts, attached relationships in plain language. Errors are assertive. Strings come from i18n message functions, never concatenation in components. A captions toggle in settings renders the live region visibly as a narration bar.

## Visual

Text contrast 4.5:1 and UI-edge contrast 3:1 in every theme; a high-contrast theme that also honours `forced-colors`; relationship kinds are distinguished by shape and dash, never by colour alone; focus is never removed; the UI reflows at 200% zoom with no horizontal scroll in the panels; `prefers-reduced-motion` disables every transition and the canvas's smooth zoom.

## Pointer

Every interactive target is at least 24×24 CSS px; every drag (move, resize, connect, waypoint, reorder in the tree) has a non-drag path (arrow keys, the Properties panel, the context menu, or the Outline); no action depends on hover, long-press or multi-point gestures.

## Text view dialect

PlantUML's class-diagram syntax is the text form because it is the one people already know and because the export comes for free:

```
abstract class Person {
  #name: String
  +getName(): String
}
class Loan {
  -dueDate: Date
  -status: LoanStatus
  +isOverdue(): boolean
}
interface Searchable {
  +search(q: String): Book[*]
}
enum LoanStatus { ACTIVE; RETURNED; OVERDUE }

Member --|> Person
Library *-- Book
Book ..|> Searchable
Member "1" -- "0..*" Loan : loans
Loan --> "1" Book : book
Loan ..> LoanStatus : <<use>>
```

Aster round-trips the subset it models and keeps lines it does not understand as comments so nothing is lost. Layout is not in the text; it lives in the layout map and in `.mdj`.

## How it is verified

Each milestone's accessibility items are checked with axe in CI, and with the scripted manual run in `docs/manual-a11y-script.md` through the lab exercise in VoiceOver on macOS and NVDA on Windows, keyboard only, before the milestone closes. The manual script is run by a human, never by an agent. Results go in `docs/accessibility-audit.md`.
