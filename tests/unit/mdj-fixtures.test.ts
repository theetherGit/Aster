/** The real StarUML files in fixtures/mdj are the codec's truth (fixtures/mdj/README.md). */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCE_PATH, parseMdjText, type ParseResult } from '#lib/mdj/parse.ts';

const dir = new URL('../../fixtures/mdj/', import.meta.url);
const files = readdirSync(dir)
	.filter((f) => f.endsWith('.mdj'))
	.sort();

type J = Record<string, unknown>;
const NODE_VIEWS = new Set([
	'UMLClassView',
	'UMLInterfaceView',
	'UMLEnumerationView',
	'UMLDataTypeView',
	'UMLPrimitiveTypeView'
]);
const EDGE_VIEWS = new Set([
	'UMLAssociationView',
	'UMLGeneralizationView',
	'UMLInterfaceRealizationView',
	'UMLRealizationView',
	'UMLDependencyView'
]);

/** Comparable, diff-friendly view of a parse: Maps flattened, #source records counted, not dumped. */
function snapshot({ project, unknown, report }: ParseResult) {
	return {
		project: {
			id: project.id,
			name: project.name,
			elements: [...project.elements.values()],
			diagrams: project.diagrams.map((d) => ({ ...d, layout: Object.fromEntries(d.layout) }))
		},
		unknown: unknown
			.filter((u) => u.path !== SOURCE_PATH)
			.map((u) => ({
				type: (u.json as J)?._type,
				id: (u.json as J)?._id,
				parentId: u.parentId,
				path: u.path,
				index: u.index
			})),
		sourceRecords: unknown.filter((u) => u.path === SOURCE_PATH).length,
		report
	};
}

it('has the public fixture corpus', () => {
	expect(files.length).toBeGreaterThanOrEqual(10);
});

describe.each(files)('%s', (file) => {
	const source = readFileSync(new URL(file, dir), 'utf8');
	const result = parseMdjText(source);
	const json = JSON.parse(source.replace(/^\uFEFF/, '')) as J;

	it('parses into at least one diagram without touching the source', () => {
		expect(result.project.diagrams.length).toBeGreaterThan(0);
		expect(JSON.stringify(parseMdjText(source).project.diagrams.map((d) => d.id))).toBe(
			JSON.stringify(result.project.diagrams.map((d) => d.id))
		);
	});

	it('gives every classifier view a node layout and every relationship view an edge layout, or keeps it with a warning', () => {
		const unknownViews = new Set(
			result.unknown.filter((u) => u.path === 'ownedViews').map((u) => (u.json as J)._id)
		);
		let placed = 0;
		let kept = 0;
		for (const d of result.project.diagrams) {
			for (const v of (findById(json, d.id)!.ownedViews as J[]) ?? []) {
				const type = v._type as string;
				if (!NODE_VIEWS.has(type) && !EDGE_VIEWS.has(type)) continue;
				if (unknownViews.has(v._id)) {
					kept++; // not placed: kept verbatim, with a warning
					continue;
				}
				placed++;
				const layout = d.layout.get((v.model as J)?.$ref as string);
				expect(layout?.kind, `${type} ${v._id} in ${d.name}`).toBe(
					NODE_VIEWS.has(type) ? 'node' : 'edge'
				);
			}
		}
		const warned = result.report.warnings.filter(
			(w) => w.code === 'viewWithoutModel' || w.code === 'duplicateView'
		).length;
		expect(kept).toBeLessThanOrEqual(warned);
		expect(placed + kept).toBe(
			result.report.diagrams.reduce((n, d) => n + d.nodes + d.edges, 0) + kept
		);
	});

	it('opens onto a diagram with classifiers whenever any diagram has some', () => {
		const opened = result.report.diagrams.find((d) => d.id === result.openDiagramId);
		if (result.report.diagrams.some((d) => d.nodes > 0)) expect(opened?.nodes).toBeGreaterThan(0);
		else expect(opened).toBeDefined();
	});

	it('reports the number of unknowns it keeps', () => {
		const unknowns = result.unknown.filter((u) => u.path !== SOURCE_PATH);
		expect(result.report.unknownElements).toBe(unknowns.length);
		expect(Object.values(result.report.unknownTypes).reduce((a, b) => a + b, 0)).toBe(
			unknowns.length
		);
	});

	it('matches its stored snapshot', async () => {
		await expect(JSON.stringify(snapshot(result), null, '\t') + '\n').toMatchFileSnapshot(
			`../../fixtures/mdj/${file.replace(/\.mdj$/, '.snapshot.json')}`
		);
	});
});

function findById(o: unknown, id: string): J | undefined {
	if (Array.isArray(o)) {
		for (const v of o) {
			const hit = findById(v, id);
			if (hit) return hit;
		}
	} else if (o && typeof o === 'object') {
		if ((o as J)._id === id) return o as J;
		for (const [k, v] of Object.entries(o)) {
			if (k === '_parent') continue;
			const hit = findById(v, id);
			if (hit) return hit;
		}
	}
	return undefined;
}
