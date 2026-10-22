/**
 * Golden round trip (data-model.md, Export rules): parse then serialize every fixture and get the
 * source back, equal ignoring key order and whitespace. Then a mutation: rename one class and
 * only that name (and the file's views of it) changes.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Stack, renameClassifier } from '#lib/commands/index.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdj } from '#lib/mdj/serialize.ts';
import type { Classifier } from '#lib/model/types.ts';

const dir = new URL('../../fixtures/mdj/', import.meta.url);
const files = readdirSync(dir)
	.filter((f) => f.endsWith('.mdj'))
	.sort();

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Paths where two JSON values differ; key order is irrelevant, array order is not. */
export function jsonDiff(a: unknown, b: unknown, path = '$'): string[] {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return [`${path}: array vs ${typeof b}`];
		if (a.length !== b.length) return [`${path}: length ${a.length} vs ${b.length}`];
		return a.flatMap((v, i) => jsonDiff(v, b[i], `${path}[${i}]`));
	}
	if (isObj(a) || isObj(b)) {
		if (!isObj(a) || !isObj(b)) return [`${path}: ${typeof a} vs ${typeof b}`];
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		return [...keys].flatMap((k) =>
			k in a && k in b
				? jsonDiff(a[k], b[k], `${path}.${k}`)
				: [`${path}.${k}: ${k in a ? 'missing in output' : 'added in output'}`]
		);
	}
	return Object.is(a, b) ? [] : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
}

const nameOf = (o: unknown) => (isObj(o) ? o.name : undefined);

describe.each(files)('%s', (file) => {
	const source = readFileSync(new URL(file, dir), 'utf8');
	const json = JSON.parse(source.replace(/^\uFEFF/, '')) as J;

	it('serialises back to its source after a no-op load', () => {
		const { project } = parseMdjText(source);
		const out = serializeMdj(project);
		expect(jsonDiff(json, out)).toEqual([]);
	});

	it('serialises the same twice: records refreshed by a save do not drift', () => {
		const { project } = parseMdjText(source);
		serializeMdj(project);
		expect(jsonDiff(json, serializeMdj(project))).toEqual([]);
	});

	it('renaming one class changes only that name', () => {
		const { project } = parseMdjText(source);
		const target = [...project.elements.values()].find(
			(e): e is Classifier => e.kind === 'classifier' && e.name !== ''
		);
		if (!target) {
			expect(project.elements.size).toBeGreaterThanOrEqual(0); // nothing named here (object diagram)
			return;
		}
		const before = structuredClone({
			elements: [...project.elements.values()],
			diagrams: project.diagrams.map((d) => ({ ...d, layout: [...d.layout] }))
		});
		new Stack(() => project).run(renameClassifier(project, { id: target.id, name: 'Renamed' }));
		const out = serializeMdj(project);
		const diffs = jsonDiff(json, out);
		// Allowed: the class's own name, the name label text of its views, and the types that
		// named it, which the rename rewrites (owner's ruling #8).
		const allowed = (d: string) =>
			/\.name: /.test(d) || /\.text: /.test(d) || /\.type: /.test(d) || /\.type\.\$ref: /.test(d);
		expect(diffs.filter((d) => !allowed(d))).toEqual([]);
		expect(diffs.some((d) => /\.name: /.test(d))).toBe(true);
		// Parsed again: the model is the same except that one name.
		const again = parseMdjText(JSON.stringify(out)).project;
		const after = {
			elements: [...again.elements.values()],
			diagrams: again.diagrams.map((d) => ({ ...d, layout: [...d.layout] }))
		};
		const renamed = before.elements.find((e) => e.id === target.id) as Classifier;
		const old = renamed.name;
		renamed.name = 'Renamed';
		for (const el of before.elements) {
			if (el.kind !== 'classifier') continue;
			for (const a of el.attributes) if (a.raw === undefined && a.type === old) a.type = 'Renamed';
			for (const o of el.operations) {
				if (o.raw !== undefined) continue;
				if (o.returnType === old) o.returnType = 'Renamed';
				for (const x of o.parameters) if (x.type === old) x.type = 'Renamed';
			}
		}
		expect(after.elements).toEqual(before.elements);
		expect(after.diagrams).toEqual(before.diagrams);
		void nameOf;
	});
});

/**
 * StarUML does not keep a hidden compartment's member views in step with the model: the lab's
 * reference files (vivekhathwar/OOADP, Manual/Facade, Bridge, Strategy) hide operations and hold
 * one view fewer than the class has operations. A no-op save must leave such a view as it is.
 */
describe('a hidden compartment with stale member views', () => {
	const source = readFileSync(new URL('public-hydgl.mdj', dir), 'utf8');
	const stale = () => {
		const json = JSON.parse(source) as J;
		const byId = new Map<string, J>();
		(function walk(o: unknown) {
			if (Array.isArray(o)) return o.forEach(walk);
			if (!isObj(o)) return;
			if (typeof o._id === 'string') byId.set(o._id, o);
			for (const [k, v] of Object.entries(o)) if (k !== '_parent') walk(v);
		})(json);
		const view = [...byId.values()].find(
			(v) =>
				v._type === 'UMLClassView' &&
				nameOf(byId.get((v.model as J).$ref as string)) === 'GraphGenerator'
		)!;
		const ops = (view.subViews as J[]).find((s) => s._type === 'UMLOperationCompartmentView')!;
		view.suppressOperations = true;
		ops.visible = false;
		(ops.subViews as J[]).pop();
		return json;
	};

	it('saves back unchanged, twice', () => {
		const json = stale();
		const { project } = parseMdjText(JSON.stringify(json));
		expect(jsonDiff(json, serializeMdj(project))).toEqual([]);
		expect(jsonDiff(json, serializeMdj(project))).toEqual([]);
	});

	it('still drops the view of an operation that was deleted', () => {
		const json = stale();
		const { project } = parseMdjText(JSON.stringify(json));
		const c = [...project.elements.values()].find(
			(e) => e.kind === 'classifier' && e.name === 'GraphGenerator'
		) as Classifier;
		const gone = c.operations[0].id;
		c.operations.shift();
		const out = JSON.stringify(serializeMdj(project));
		expect(out).not.toContain(`"model":{"$ref":"${gone}"}`);
	});
});
