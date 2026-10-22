/**
 * The demo at `/design/demo`: Aster's own design, drawn in Aster. Two class diagrams (the model,
 * and how a user action reaches the canvas) with packages, and an object diagram of a tiny project.
 * Every name and member here is the code's own (src/lib/model/types.ts, commands, stores, mdj);
 * `tests/unit/demo.test.ts` checks that each line parses and the file round-trips.
 */
import { memberFromText } from '#lib/mdj/expression.ts';
import {
	createClassifier,
	createDiagram,
	createInstance,
	createLink,
	createPackage,
	createProject,
	createRelationship,
	createSlot,
	defaultEdgeLayout,
	defaultEnds,
	defaultNodeLayout
} from './project.ts';
import type {
	Attribute,
	Classifier,
	ClassifierKind,
	Diagram,
	Element,
	Id,
	LineStyle,
	Literal,
	Operation,
	Project,
	RelationshipKind
} from './types.ts';

interface ClassSpec {
	kind?: ClassifierKind;
	stereotype?: string;
	isAbstract?: boolean;
	attributes?: string[];
	operations?: string[];
	literals?: string[];
	documentation?: string;
}

export function demoProject(): Project {
	const project = createProject({ id: 'demo', name: 'Aster' });
	const add = (el: Element) => project.elements.set(el.id, el);
	const place = (d: Diagram, id: Id, x: number, y: number, w = 160, h = 60) => {
		d.elementIds.push(id);
		d.layout.set(id, { ...defaultNodeLayout(x, y), w, h });
	};
	const cls = (id: Id, name: string, spec: ClassSpec, packageId?: Id): Classifier => {
		const c = createClassifier({
			id,
			name,
			classifierKind: spec.kind ?? 'class',
			isAbstract: spec.isAbstract ?? false,
			documentation: spec.documentation ?? '',
			attributes: (spec.attributes ?? []).map(
				(text, i) => memberFromText('attribute', text, `${id}-a${i}`) as Attribute
			),
			operations: (spec.operations ?? []).map(
				(text, i) => memberFromText('operation', text, `${id}-o${i}`) as Operation
			),
			literals: (spec.literals ?? []).map(
				(text, i) => memberFromText('literal', text, `${id}-l${i}`) as Literal
			),
			...(spec.stereotype && { stereotype: spec.stereotype }),
			...(packageId && { packageId })
		});
		add(c);
		if (packageId) {
			const p = project.elements.get(packageId);
			if (p?.kind === 'package') p.memberIds.push(id);
		}
		return c;
	};
	const pkg = (id: Id, name: string, documentation: string) =>
		add(createPackage({ id, name, documentation }));
	const rel = (
		id: Id,
		relationshipKind: RelationshipKind,
		sourceId: Id,
		targetId: Id,
		extra: { name?: string; stereotype?: string; source?: string; target?: string } = {}
	) => {
		const ends = defaultEnds(relationshipKind);
		if (ends.sourceEnd && extra.source !== undefined) ends.sourceEnd.multiplicity = extra.source;
		if (ends.targetEnd && extra.target !== undefined) ends.targetEnd.multiplicity = extra.target;
		add(
			createRelationship({
				id,
				relationshipKind,
				sourceId,
				targetId,
				...ends,
				...(extra.name && { name: extra.name }),
				...(extra.stereotype && { stereotype: extra.stereotype })
			})
		);
	};
	const edge = (d: Diagram, lineStyle: LineStyle, ...ids: Id[]) => {
		for (const id of ids) {
			d.elementIds.push(id);
			d.layout.set(id, { ...defaultEdgeLayout(), lineStyle });
		}
	};

	// ---- The model package -------------------------------------------------------------------
	pkg('pkg-model', 'model', 'Plain TypeScript, no Svelte: the single source of truth.');
	pkg('pkg-commands', 'commands', 'One function per user action; each returns its inverse.');
	pkg(
		'pkg-stores',
		'stores',
		'Svelte state: the open project, selection, and what the canvas draws.'
	);
	pkg('pkg-mdj', 'mdj', "StarUML's .mdj, read and written field for field.");
	pkg('pkg-canvas', 'canvas', 'The Svelte Flow canvas: nodes and edges derived from the model.');

	cls(
		'Project',
		'Project',
		{
			attributes: ['+ id: Id', '+ name: string', '+ importedIds: Set<Id>'],
			documentation: 'A whole file: its diagrams and every model element by id.'
		},
		'pkg-model'
	);
	cls(
		'Diagram',
		'Diagram',
		{
			attributes: [
				'+ id: Id',
				'+ name: string',
				'+ diagramKind: DiagramKind',
				'+ elementIds: Id[*]',
				'+ defaults: DisplayFlags'
			],
			documentation: 'Which elements have a view here, in z-order, and where each is drawn.'
		},
		'pkg-model'
	);
	cls(
		'Element',
		'Element',
		{
			kind: 'interface',
			attributes: ['+ kind: string', '+ id: Id'],
			documentation: 'A union of every model element; `kind` tells them apart.'
		},
		'pkg-model'
	);
	cls(
		'Classifier',
		'Classifier',
		{
			attributes: [
				'+ name: string',
				'+ classifierKind: ClassifierKind',
				'+ isAbstract: boolean',
				'+ packageId: Id'
			]
		},
		'pkg-model'
	);
	cls(
		'Relationship',
		'Relationship',
		{
			attributes: [
				'+ relationshipKind: RelationshipKind',
				'+ sourceId: Id',
				'+ targetId: Id',
				'+ name: string'
			]
		},
		'pkg-model'
	);
	cls(
		'Package',
		'Package',
		{
			attributes: ['+ name: string', '+ parentId: Id', '+ memberIds: Id[*]']
		},
		'pkg-model'
	);
	cls(
		'Instance',
		'Instance',
		{
			attributes: ['+ name: string', '+ classifier: string'],
			documentation: 'An object: its class by name, as an attribute names its type.'
		},
		'pkg-model'
	);
	cls(
		'Attribute',
		'Attribute',
		{
			attributes: ['+ name: string', '+ type: string', '+ visibility: Visibility']
		},
		'pkg-model'
	);
	cls(
		'Operation',
		'Operation',
		{
			attributes: ['+ name: string', '+ returnType: string', '+ parameters: Parameter[*]']
		},
		'pkg-model'
	);
	cls('Slot', 'Slot', { attributes: ['+ name: string', '+ value: string'] }, 'pkg-model');
	cls(
		'ClassifierKind',
		'ClassifierKind',
		{
			kind: 'enum',
			literals: ['class', 'interface', 'enum', 'dataType', 'primitiveType']
		},
		'pkg-model'
	);

	rel('r-project-diagram', 'composition', 'Diagram', 'Project', { source: '0..*', target: '1' });
	rel('r-project-element', 'composition', 'Element', 'Project', { source: '0..*', target: '1' });
	for (const k of ['Classifier', 'Relationship', 'Package', 'Instance'])
		rel(`r-${k}-element`, 'realization', k, 'Element');
	rel('r-classifier-attribute', 'composition', 'Attribute', 'Classifier', {
		source: '0..*',
		target: '1'
	});
	rel('r-classifier-operation', 'composition', 'Operation', 'Classifier', {
		source: '0..*',
		target: '1'
	});
	rel('r-instance-slot', 'composition', 'Slot', 'Instance', { source: '0..*', target: '1' });
	rel('r-classifier-kind', 'dependency', 'Classifier', 'ClassifierKind');

	// ---- How a user action reaches the canvas ------------------------------------------------
	cls(
		'Command',
		'Command',
		{
			kind: 'interface',
			attributes: ['+ id: string', '+ label: string', '+ touches: string[*]'],
			operations: ['+ apply(project: Project): Command'],
			documentation: 'Applies itself in place and returns the command that undoes it.'
		},
		'pkg-commands'
	);
	cls(
		'Stack',
		'Stack',
		{
			attributes: ['+ canUndo: boolean', '+ canRedo: boolean'],
			operations: ['+ run(command: Command): string', '+ undo(): string', '+ redo(): string'],
			documentation: 'The undo stack: inverses, coalesced drags, 500 steps.'
		},
		'pkg-commands'
	);
	cls(
		'ProjectStore',
		'ProjectStore',
		{
			attributes: ['+ project: Project', '+ activeDiagramId: Id', '+ version: number'],
			operations: [
				'+ run(factory: Factory, args: A): string',
				'+ undo(): string',
				'+ redo(): string'
			]
		},
		'pkg-stores'
	);
	cls(
		'Flow',
		'Flow',
		{
			attributes: ['+ nodes: FlowNode[*]', '+ edges: FlowEdge[*]'],
			documentation: 'Svelte Flow nodes and edges, derived from project and layout. Never mutated.'
		},
		'pkg-stores'
	);
	cls(
		'Selection',
		'Selection',
		{
			attributes: ['+ list: Id[*]', '+ focus: Focus', '+ editing: Editing']
		},
		'pkg-stores'
	);
	cls(
		'Mdj',
		'Mdj',
		{
			stereotype: 'utility',
			operations: [
				'+ parseMdjText(source: string): ParseResult',
				'+ serializeMdj(project: Project): Json'
			]
		},
		'pkg-mdj'
	);
	cls(
		'Canvas',
		'Canvas',
		{
			stereotype: 'component',
			documentation: 'Canvas.svelte: one Tab stop, roving focus inside.'
		},
		'pkg-canvas'
	);

	rel('r-stack-command', 'aggregation', 'Command', 'Stack', {
		name: 'history',
		source: '0..*',
		target: '1'
	});
	rel('r-store-stack', 'composition', 'Stack', 'ProjectStore', { source: '1', target: '1' });
	rel('r-command-project', 'dependency', 'Command', 'Project', { stereotype: 'changes' });
	rel('r-flow-store', 'dependency', 'Flow', 'ProjectStore', { stereotype: 'derive' });
	rel('r-canvas-flow', 'dependency', 'Canvas', 'Flow', { stereotype: 'draws' });
	rel('r-canvas-selection', 'dependency', 'Canvas', 'Selection');
	rel('r-canvas-store', 'dependency', 'Canvas', 'ProjectStore', { stereotype: 'runs commands' });
	rel('r-mdj-project', 'dependency', 'Mdj', 'Project', { stereotype: 'reads and writes' });

	const note = {
		kind: 'note' as const,
		id: 'n-derived',
		text: 'Nodes and edges are derived from the model and never edited directly: every action is a Command that returns its inverse.',
		linkedIds: ['Flow', 'Command']
	};
	add(note);

	// ---- An object diagram: the sample library, as the model holds it -------------------------
	for (const [id, name, cls, slots] of [
		['o-project', 'library', 'Project', [['name', '"Library"']]],
		[
			'o-diagram',
			'main',
			'Diagram',
			[
				['name', '"Main"'],
				['diagramKind', 'class']
			]
		],
		[
			'o-account',
			'account',
			'Classifier',
			[
				['name', '"Account"'],
				['isAbstract', 'true']
			]
		],
		[
			'o-customer',
			'customer',
			'Classifier',
			[
				['name', '"Customer"'],
				['isAbstract', 'false']
			]
		]
	] as const)
		add(
			createInstance({
				id,
				name,
				classifier: cls,
				slots: slots.map(([n, v], i) => createSlot(n, v, `${id}-s${i}`))
			})
		);
	for (const [id, s, t] of [
		['l-1', 'o-project', 'o-diagram'],
		['l-2', 'o-project', 'o-account'],
		['l-3', 'o-project', 'o-customer'],
		['l-4', 'o-diagram', 'o-account'],
		['l-5', 'o-diagram', 'o-customer']
	] as const)
		add(createLink({ id, sourceId: s, targetId: t }));

	// ---- Diagrams and layout -------------------------------------------------------------------
	const model = createDiagram({ id: 'd-model', name: 'Model' });
	const flow = createDiagram({ id: 'd-flow', name: 'From key to canvas' });
	const objects = createDiagram({
		id: 'd-objects',
		name: 'A project in memory',
		diagramKind: 'object'
	});
	project.diagrams.push(model, flow, objects);
	for (const d of [model, flow]) d.defaults = { ...d.defaults, showNamespace: false };

	// The model: its root on the left, the element kinds in a row under the interface they share.
	place(model, 'pkg-model', 40, 40, 1340, 700);
	place(model, 'Project', 80, 100, 200);
	place(model, 'Diagram', 80, 300, 200);
	place(model, 'Element', 700, 100, 180);
	place(model, 'Classifier', 340, 320, 240);
	place(model, 'Relationship', 620, 320, 270);
	place(model, 'Package', 930, 320, 180);
	place(model, 'Instance', 1150, 320, 180);
	place(model, 'ClassifierKind', 80, 560, 160);
	place(model, 'Attribute', 290, 560, 190);
	place(model, 'Operation', 510, 560, 230);
	place(model, 'Slot', 1150, 560, 180);
	edge(model, 'oblique', 'r-project-diagram', 'r-project-element');
	// The four kinds meet Element as one tree: up to a shared rail, then into its bottom.
	for (const [id, x] of [
		['r-Classifier-element', 460],
		['r-Relationship-element', 755],
		['r-Package-element', 1020],
		['r-Instance-element', 1240]
	] as const) {
		edge(model, 'rectilinear', id);
		const l = model.layout.get(id);
		if (l?.kind === 'edge')
			l.waypoints = [
				{ x, y: 260 },
				{ x: 790, y: 260 }
			];
	}
	edge(
		model,
		'oblique',
		'r-classifier-attribute',
		'r-classifier-operation',
		'r-instance-slot',
		'r-classifier-kind'
	);

	// From key to canvas, left to right: the canvas reads the stores, the store runs commands on
	// the model, and the .mdj codec reads and writes the same model.
	place(flow, 'pkg-canvas', 40, 220, 260, 200);
	place(flow, 'pkg-stores', 340, 40, 340, 640);
	place(flow, 'pkg-commands', 720, 240, 640, 240);
	place(flow, 'pkg-mdj', 1400, 520, 360, 180);
	place(flow, 'Canvas', 80, 290, 180);
	place(flow, 'Flow', 380, 100, 260);
	place(flow, 'ProjectStore', 380, 290, 280);
	place(flow, 'Selection', 380, 520, 200);
	place(flow, 'Stack', 760, 300, 260);
	place(flow, 'Command', 1060, 300, 270);
	place(flow, 'Project', 1460, 300, 200);
	place(flow, 'Mdj', 1420, 580, 320);
	place(flow, 'n-derived', 760, 60, 320, 84);
	edge(
		flow,
		'oblique',
		'r-canvas-flow',
		'r-canvas-store',
		'r-canvas-selection',
		'r-flow-store',
		'r-store-stack',
		'r-stack-command',
		'r-command-project',
		'r-mdj-project'
	);

	// The sample library as the model holds it: a diamond, so no two links cross.
	place(objects, 'o-project', 80, 220, 200);
	place(objects, 'o-account', 420, 60, 220);
	place(objects, 'o-customer', 420, 380, 220);
	place(objects, 'o-diagram', 780, 220, 220);
	edge(objects, 'oblique', 'l-1', 'l-2', 'l-3', 'l-4', 'l-5');
	return project;
}
