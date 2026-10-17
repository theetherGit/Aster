# Expression grammar fixtures

`lines.json` is the parser's truth for `src/lib/mdj/expression.ts`. Each entry:

```json
{
  "kind": "attribute | operation | literal | parameter",
  "input": "the line as typed or as found in a StarUML text field",
  "expected": { ...the parsed structure, or { "raw": "..." } for lines that must not parse... },
  "canonical": "what render(parse(input)) must produce; omit when expected is raw"
}
```

The expected shape mirrors `Attribute` / `Operation` / `Literal` / `Parameter` in `src/lib/model/types.ts`, without `id` and `documentation`. Absent optional fields are omitted, not null.

The 20 shipped lines were written from the grammar in `docs/spec/data-model.md`. **Add at least 20 more copied verbatim from the `text` fields of `UMLAttributeView` and `UMLOperationView` entries in real `.mdj` files** before M1 day 2, so the parser is tested on what StarUML actually writes, not on what the grammar says it should.
