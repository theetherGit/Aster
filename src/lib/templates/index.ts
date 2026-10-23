/**
 * The template gallery (features.md M3, "Docs and templates"; owner's choice of content,
 * 2026-10-23: the projects on the owner's GitHub rather than generic textbook domains). Each
 * template is a spec read off its repository (names and members are the code's own, written as
 * UML text) plus a layout made once by Aster's own auto-layout (`tests/unit/templates.test.ts`
 * writes `layouts/<id>.json`; `pnpm test -u` remakes them). Pure: no Svelte, no DOM.
 */
import { memberFromText } from '#lib/mdj/expression.ts';
import { newId } from '#lib/model/ids.ts';
import {
	createClassifier,
	createDiagram,
	createPackage,
	createProject,
	createRelationship,
	defaultEdgeLayout,
	defaultEnds,
	defaultNodeLayout
} from '#lib/model/project.ts';
import type {
	Attribute,
	ClassifierKind,
	Literal,
	Operation,
	Point,
	Project,
	RelationshipKind
} from '#lib/model/types.ts';

export interface TemplateClass {
	id: string;
	name: string;
	kind: Extract<ClassifierKind, 'class' | 'interface' | 'enum' | 'dataType'>;
	package: string | null;
	stereotype: string | null;
	isAbstract: boolean;
	attributes: string[];
	operations: string[];
	literals?: string[];
	/** The repository file it was read from. */
	source?: string;
}
export interface TemplateRelationship {
	id: string;
	kind: RelationshipKind;
	/** For aggregation and composition, the part; the target is the whole (as in the model). */
	source: string;
	target: string;
	name: string | null;
	stereotype: string | null;
	sourceMultiplicity: string | null;
	targetMultiplicity: string | null;
}
export interface TemplateDiagram {
	name: string;
	packages: { id: string; name: string; parent: string | null }[];
	classes: TemplateClass[];
	relationships: TemplateRelationship[];
}
export interface TemplateSpec {
	id: string;
	name: string;
	/** `owner/name` on GitHub, and its address. */
	repo: string;
	url: string;
	summary: string;
	description: string;
	diagrams: TemplateDiagram[];
	notes?: string;
}
/** Per diagram (by index): each node's box and each line's bends. */
export type TemplateLayout = {
	nodes: Record<string, { x: number; y: number; w: number; h: number }>;
	edges: Record<string, Point[]>;
}[];

/** A relationship's element id: unique across the template's diagrams. */
export const relationshipId = (diagram: number, id: string) => `d${diagram}-${id}`;
/** The packages a diagram draws: those holding one of its classes, and their parents. */
export function framesOf(d: TemplateDiagram): string[] {
	const out = new Set<string>();
	const add = (id: string | null) => {
		while (id && !out.has(id)) {
			out.add(id);
			id = d.packages.find((p) => p.id === id)?.parent ?? null;
		}
	};
	for (const c of d.classes) add(c.package);
	return d.packages.filter((p) => out.has(p.id)).map((p) => p.id);
}

/**
 * A new project from a template: its own id, named after the template. Without a layout (only
 * while one is being made) every box sits on a grid.
 */
export function templateProject(spec: TemplateSpec, layout?: TemplateLayout): Project {
	const project = createProject({ id: newId(), name: spec.name });
	spec.diagrams.forEach((d, i) => {
		const diagram = createDiagram({ id: `${spec.id}-d${i}`, name: d.name });
		project.diagrams.push(diagram);
		const placed = layout?.[i];
		const box = (id: string, k: number, w: number, h: number) => {
			const at = placed?.nodes[id];
			return at
				? { ...defaultNodeLayout(at.x, at.y), w: at.w, h: at.h }
				: { ...defaultNodeLayout(40 + (k % 4) * 260, 40 + Math.floor(k / 4) * 220), w, h };
		};
		// Packages first, at the back of the diagram (as addPackage puts them).
		for (const [k, id] of framesOf(d).entries()) {
			const p = d.packages.find((x) => x.id === id)!;
			if (!project.elements.has(id))
				project.elements.set(
					id,
					createPackage({ id, name: p.name, ...(p.parent && { parentId: p.parent }) })
				);
			diagram.elementIds.push(id);
			diagram.layout.set(id, box(id, k, 240, 160));
		}
		for (const [k, c] of d.classes.entries()) {
			if (!project.elements.has(c.id))
				project.elements.set(
					c.id,
					createClassifier({
						id: c.id,
						name: c.name,
						classifierKind: c.kind,
						isAbstract: c.isAbstract,
						documentation: c.source ? `From \`${c.source}\` in ${spec.repo}.` : '',
						attributes: c.attributes.map(
							(text, j) => memberFromText('attribute', text, `${c.id}-a${j}`) as Attribute
						),
						operations: c.operations.map(
							(text, j) => memberFromText('operation', text, `${c.id}-o${j}`) as Operation
						),
						literals: (c.literals ?? []).map(
							(text, j) => memberFromText('literal', text, `${c.id}-l${j}`) as Literal
						),
						...(c.stereotype && { stereotype: c.stereotype }),
						...(c.package && { packageId: c.package })
					})
				);
			diagram.elementIds.push(c.id);
			diagram.layout.set(c.id, box(c.id, k, 160, 80));
		}
		for (const r of d.relationships) {
			const id = relationshipId(i, r.id);
			const ends = defaultEnds(r.kind);
			if (ends.sourceEnd && r.sourceMultiplicity)
				ends.sourceEnd.multiplicity = r.sourceMultiplicity;
			if (ends.targetEnd && r.targetMultiplicity)
				ends.targetEnd.multiplicity = r.targetMultiplicity;
			project.elements.set(
				id,
				createRelationship({
					id,
					relationshipKind: r.kind,
					sourceId: r.source,
					targetId: r.target,
					...ends,
					...(r.name && { name: r.name }),
					...(r.stereotype && { stereotype: r.stereotype })
				})
			);
			diagram.elementIds.push(id);
			const waypoints = placed?.edges[id];
			diagram.layout.set(id, {
				...defaultEdgeLayout(),
				...(placed && { lineStyle: 'rectilinear' as const }),
				...(waypoints && { waypoints })
			});
		}
	});
	// memberIds follows packageId / parentId (the commands keep it so).
	for (const el of project.elements.values()) {
		const owner =
			el.kind === 'classifier' ? el.packageId : el.kind === 'package' ? el.parentId : undefined;
		const p = owner ? project.elements.get(owner) : undefined;
		if (p?.kind === 'package' && !p.memberIds.includes(el.id)) p.memberIds.push(el.id);
	}
	return project;
}

const specs = import.meta.glob<TemplateSpec>('./specs/*.json', { import: 'default' });
const layouts = import.meta.glob<TemplateLayout>('./layouts/*.json', { import: 'default' });
const idOf = (path: string) => path.replace(/^.*\/|\.json$/g, '');

/** The gallery's templates, in the order shown: each loads when the gallery opens. */
export const TEMPLATE_IDS: string[] = Object.keys(specs).map(idOf).sort();

export async function loadTemplate(
	id: string
): Promise<{ spec: TemplateSpec; layout?: TemplateLayout }> {
	const spec = await specs[`./specs/${id}.json`]();
	const layout = await layouts[`./layouts/${id}.json`]?.();
	return { spec, layout };
}
