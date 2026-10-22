import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePuml } from '#lib/puml/parse.ts';

// The docs' Text view page (docs-site/src/content/docs/guides/text-view.mdx): its example and
// every arrow it lists go through the app's PlantUML parser, so the page cannot drift from it.

const page = readFileSync(
	new URL('../../docs-site/src/content/docs/guides/text-view.mdx', import.meta.url),
	'utf8'
);
const example = /## Example[\s\S]*?```text\n([\s\S]*?)```/.exec(page)![1];
const arrows = [...page.matchAll(/^- `(A [^`]+ B)`: (\w+)(?:, A is the whole)?/gm)].map(
	([whole, arrow, kind]) => ({ arrow, kind, whole: whole.includes('A is the whole') })
);

describe('docs: Text view page', () => {
	it('its example reads with no errors', () => {
		const doc = parsePuml(example);
		expect(doc.errors).toEqual([]);
		expect(doc.classifiers.length).toBe(7);
		expect(doc.relationships.length).toBe(6);
	});
	it('ignores a direction hint in an arrow, as the page says', () => {
		expect(page).toContain('`-up->`');
		const [r] = parsePuml('@startuml\nclass A\nclass B\nA -up-> B\n@enduml').relationships;
		expect(r.kind).toBe('association');
	});
	it('lists every relationship kind', () => {
		expect(new Set(arrows.map((a) => a.kind)).size).toBe(6);
	});
	it.each(arrows)('`$arrow` is a $kind', ({ arrow, kind, whole }) => {
		const [r] = parsePuml(`@startuml\nclass A\nclass B\n${arrow}\n@enduml`).relationships;
		expect(r.kind).toBe(kind);
		// The model's source is the child, the implementer, the client or the part.
		if (whole) expect([r.source, r.target]).toEqual(['B', 'A']);
		else if (kind !== 'association') expect([r.source, r.target]).toEqual(['A', 'B']);
	});
});

describe('docs: validation rules page', () => {
	const rules = readFileSync(
		new URL('../../docs-site/src/content/docs/reference/validation.mdx', import.meta.url),
		'utf8'
	);
	const listed = [...rules.matchAll(/^\| (UML\d{3}|ASTER\d{3}) \| (.+?) \|/gm)];
	it('lists every rule the app checks, with its message', async () => {
		const en = (await import('#lib/i18n/en.json')).default as Record<string, string>;
		const ids = new Set(
			Object.keys(en).flatMap((k) => /^validation\.((?:UML|ASTER)\d{3})/.exec(k)?.[1] ?? [])
		);
		expect(listed.map(([, id]) => id).sort()).toEqual([...ids].sort());
		for (const [, id, message] of listed)
			if (id.startsWith('UML')) expect(message).toBe(en[`validation.${id}`]);
	});
});
