/**
 * The template gallery (features.md M3): every template's member lines parse, every reference
 * resolves, each project round-trips through .mdj and .aster, and its layout is Aster's own
 * auto-layout of it (packages as frames), written to src/lib/templates/layouts/<id>.json —
 * `pnpm test -u` remakes a layout after its spec changes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';
import { parseAster, serializeAster } from '#lib/aster/index.ts';
import { layout, type LayoutInput } from '#lib/canvas/autolayout.ts';
import { contentRects } from '#lib/export/svg.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdjText } from '#lib/mdj/serialize.ts';
import {
	framesOf,
	relationshipId,
	templateProject,
	type TemplateLayout,
	type TemplateSpec
} from '#lib/templates/index.ts';

const dir = new URL('../../src/lib/templates/specs/', import.meta.url);
const specs: TemplateSpec[] = readdirSync(dir)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

/** The layout Aster's auto-layout gives the template (orthogonal, top to bottom). */
async function laidOut(spec: TemplateSpec): Promise<TemplateLayout> {
	const project = templateProject(spec);
	const out: TemplateLayout = [];
	for (const [i, d] of spec.diagrams.entries()) {
		const diagram = project.diagrams[i];
		const rects = contentRects(project, diagram);
		const frames = new Set(framesOf(d));
		const input: LayoutInput = { nodes: [], edges: [] };
		for (const id of frames) {
			const parent = d.packages.find((p) => p.id === id)?.parent;
			input.nodes.push({ id, w: 240, h: 160, frame: true, parent: parent ?? undefined });
		}
		for (const c of d.classes) {
			const r = rects.get(c.id)!;
			input.nodes.push({ id: c.id, w: r.w, h: r.h, parent: c.package ?? undefined });
		}
		for (const r of d.relationships)
			if (r.source !== r.target)
				input.edges.push({
					id: relationshipId(i, r.id),
					source: r.source,
					target: r.target,
					upward: r.kind === 'generalization' || r.kind === 'realization',
					labelled: !!(r.name || r.stereotype || r.sourceMultiplicity || r.targetMultiplicity)
				});
		const res = await layout(
			new ELK(),
			input,
			{ algorithm: 'orthogonal', direction: 'DOWN' },
			{ x: 40, y: 40 }
		);
		const nodes: TemplateLayout[number]['nodes'] = {};
		for (const n of input.nodes) {
			const at = res.positions.get(n.id)!;
			const size = res.sizes.get(n.id) ?? { w: n.w, h: n.h };
			nodes[n.id] = { x: at.x, y: at.y, w: size.w, h: size.h };
		}
		out.push({ nodes, edges: Object.fromEntries(res.waypoints) });
	}
	return out;
}

describe.each(specs.map((s) => [s.id, s] as const))('template %s', (id, spec) => {
	it('says where it comes from', () => {
		expect(spec.url).toBe(`https://github.com/${spec.repo}`);
		expect(spec.name && spec.summary && spec.description).toBeTruthy();
	});

	it('parses every member line, and every reference resolves', () => {
		const p = templateProject(spec);
		for (const el of p.elements.values()) {
			if (el.kind !== 'classifier') continue;
			for (const m of [...el.attributes, ...el.operations])
				expect(m.raw, `${el.name}: ${m.raw}`).toBeUndefined();
		}
		for (const d of spec.diagrams) {
			const ids = new Set(d.classes.map((c) => c.id));
			for (const r of d.relationships) {
				expect(ids.has(r.source), `${r.id} source ${r.source}`).toBe(true);
				expect(ids.has(r.target), `${r.id} target ${r.target}`).toBe(true);
			}
			for (const c of d.classes)
				if (c.package)
					expect(
						d.packages.some((x) => x.id === c.package),
						c.id
					).toBe(true);
			expect(d.classes.length).toBeLessThanOrEqual(16);
		}
	});

	it('has its layout from Aster’s own auto-layout', async () => {
		const made = JSON.stringify(await laidOut(spec), null, '\t') + '\n';
		await expect(made).toMatchFileSnapshot(`../../src/lib/templates/layouts/${id}.json`);
	});

	it('round-trips through .mdj and .aster', async () => {
		const p = templateProject(spec, await laidOut(spec));
		const back = parseMdjText(serializeMdjText(p)).project;
		for (const [key, el] of p.elements) expect(back.elements.get(key), key).toMatchObject(el);
		expect(parseAster(serializeAster(p)).project).toEqual(p);
	});
});
