/**
 * The demo (`/design/demo`): Aster's own design. Every member line parses, every relationship and
 * view points at something real, and the project round-trips through .mdj and .aster.
 */
import { describe, expect, it } from 'vitest';
import { parseAster, serializeAster } from '#lib/aster/index.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdjText } from '#lib/mdj/serialize.ts';
import { demoProject } from '#lib/model/demo.ts';

describe('the demo project', () => {
	const p = demoProject();

	it('parses every member line, and every reference resolves', () => {
		for (const el of p.elements.values()) {
			if (el.kind !== 'classifier') continue;
			for (const m of [...el.attributes, ...el.operations])
				expect(m.raw, `${el.name}: ${m.raw}`).toBeUndefined();
			if (el.packageId) expect(p.elements.get(el.packageId)?.kind).toBe('package');
		}
		for (const el of p.elements.values())
			if (el.kind === 'relationship' || el.kind === 'link') {
				expect(p.elements.has(el.sourceId), el.id).toBe(true);
				expect(p.elements.has(el.targetId), el.id).toBe(true);
			}
		for (const d of p.diagrams)
			for (const id of d.elementIds) {
				expect(p.elements.has(id), id).toBe(true);
				expect(d.layout.has(id), id).toBe(true);
			}
		expect(p.diagrams.map((d) => d.diagramKind)).toEqual(['class', 'class', 'object']);
	});

	it('round-trips through .mdj and .aster', () => {
		const back = parseMdjText(serializeMdjText(p)).project;
		expect([...back.elements.keys()].sort()).toEqual([...p.elements.keys()].sort());
		// Reading an association back fills its ends' default visibility; nothing else differs.
		for (const [id, el] of p.elements) expect(back.elements.get(id), id).toMatchObject(el);
		expect(parseAster(serializeAster(p)).project).toEqual(p);
	});
});
