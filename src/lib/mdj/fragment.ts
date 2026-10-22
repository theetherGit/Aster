/**
 * features.md `.mdj` import / export (M3): fragment import. A StarUML fragment (`.mfj`, File ›
 * Export › Fragment) is one element and everything it owns. It is read with the project parser by
 * wrapping it in a project of its own, so classes, relationships, diagrams and the parts Aster does
 * not model come in exactly as an opened `.mdj` would. Owner's ruling (2026-10-22), StarUML's
 * behaviour: model only, nothing is placed on the open diagram; diagrams inside become new tabs.
 */
import { newId } from '#lib/model/ids.ts';
import type { Diagram, Element, Id, Project, Unknown } from '#lib/model/types.ts';
import { MdjError, SOURCE_PATH, parseMdj, type ParseReport } from './parse.ts';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A diagram as plain data, as the undo stack keeps it (`layout` as entries). */
export interface DiagramData extends Omit<Diagram, 'layout'> {
	layout: [Id, Diagram['layout'] extends Map<Id, infer L> ? L : never][];
}
export interface Fragment {
	/** The package it goes under; none for the top of the model. */
	packageId?: Id;
	/** Its name, for the undo label and the toast. */
	name: string;
	elements: Element[];
	diagrams: DiagramData[];
	/** What Aster does not model, kept for export under its parent (a fragment element, or where it lands). */
	unknown: Unknown[];
}

const WRAP_PROJECT = '\u0000fragment-project';
const WRAP_MODEL = '\u0000fragment-model';

/** Every `_id` in a JSON tree. */
function ids(o: unknown, out = new Set<string>()): Set<string> {
	if (Array.isArray(o)) for (const v of o) ids(v, out);
	else if (isObj(o)) {
		if (typeof o._id === 'string') out.add(o._id);
		for (const [k, v] of Object.entries(o)) if (k !== '_parent') ids(v, out);
	}
	return out;
}
/** A copy with every `_id` and `$ref` in `map` renamed. */
function rename(o: unknown, map: Map<string, string>): unknown {
	if (Array.isArray(o)) return o.map((v) => rename(v, map));
	if (!isObj(o)) return o;
	const out: Json = {};
	for (const [k, v] of Object.entries(o))
		out[k] =
			(k === '_id' || k === '$ref') && typeof v === 'string' ? (map.get(v) ?? v) : rename(v, map);
	return out;
}

/** The project's own top-level model, where things outside any package are written. */
const modelId = (p: Project) =>
	p.unknown.find(
		(u) =>
			u.path === SOURCE_PATH &&
			isObj(u.json) &&
			u.json._type === 'UMLModel' &&
			isObj(u.json._parent) &&
			u.json._parent.$ref === p.id
	)?.parentId;

/**
 * Reads a fragment's JSON for `project`, to go under `packageId` (or the top of the model).
 * Ids are kept, as on open, unless one is already taken here (the same fragment twice, or a
 * piece of this very project): then every id in it is new, references included.
 * Throws `MdjError` when the JSON is not a StarUML element.
 */
export function readFragment(
	json: unknown,
	project: Project,
	packageId?: Id
): { payload: Fragment; report: ParseReport } {
	if (!isObj(json) || typeof json._type !== 'string' || typeof json._id !== 'string')
		throw new MdjError('not a StarUML fragment');
	// A whole project picked by mistake comes in as its contents.
	const roots =
		json._type === 'Project' && Array.isArray(json.ownedElements) ? json.ownedElements : [json];

	const here = new Set<string>([
		project.id,
		...project.elements.keys(),
		...project.diagrams.map((d) => d.id)
	]);
	for (const u of project.unknown) ids(u.json, here);
	const theirs = ids(roots);
	const taken = [...theirs].some((id) => here.has(id));
	const tree = taken ? rename(roots, new Map([...theirs].map((id) => [id, newId()]))) : roots;

	const { project: read, report } = parseMdj({
		_type: 'Project',
		_id: WRAP_PROJECT,
		name: '',
		ownedElements: [{ _type: 'UMLModel', _id: WRAP_MODEL, name: '', ownedElements: tree }]
	});

	const elements = [...read.elements.values()];
	if (packageId)
		for (const e of elements) {
			if (e.kind === 'classifier' && !e.packageId) e.packageId = packageId;
			if (e.kind === 'package' && !e.parentId) e.parentId = packageId;
		}
	// The wrapper's own records go; what sat at the top of the fragment moves to where it lands.
	const top = packageId ?? modelId(project);
	const unknown = read.unknown.flatMap((u): Unknown[] => {
		if (u.parentId !== WRAP_MODEL && u.parentId !== WRAP_PROJECT) return [u];
		if (u.path === SOURCE_PATH || !top) return [];
		// ponytail: written after the target's own children; StarUML keeps no order across a merge
		return [{ ...u, parentId: top, index: Number.MAX_SAFE_INTEGER }];
	});
	const first = roots.find(isObj);
	return {
		payload: {
			packageId,
			name: typeof first?.name === 'string' && first.name ? first.name : String(first?._type ?? ''),
			elements,
			diagrams: read.diagrams.map((d) => ({ ...d, layout: [...d.layout.entries()] })),
			unknown
		},
		report
	};
}
