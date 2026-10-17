/** One test per row of the mapping table (docs/spec/data-model.md), on minimal hand-written JSON. */
import { describe, expect, it } from 'vitest';
import {
	MdjError,
	SOURCE_PATH,
	STARUML_VIEW_DEFAULTS,
	parseMdj,
	parseMdjText,
	parsePoints
} from '#lib/mdj/parse.ts';
import type {
	Classifier,
	EdgeLayout,
	Element,
	NodeLayout,
	Note,
	Package,
	Relationship
} from '#lib/model/types.ts';

type J = Record<string, unknown>;
const ref = (id: string) => ({ $ref: id });
const model = (children: J[], id = 'M', name = 'Model'): J => ({
	_type: 'UMLModel',
	_id: id,
	_parent: ref('P'),
	name,
	ownedElements: children
});
const doc = (top: J[], extra: J = {}): J => ({
	_type: 'Project',
	_id: 'P',
	name: 'Proj',
	ownedElements: top,
	...extra
});
const one = (children: J[]) => doc([model(children)]);
const cls = (id: string, extra: J = {}): J => ({ _type: 'UMLClass', _id: id, name: id, ...extra });
const diagram = (id: string, views: J[], extra: J = {}): J => ({
	_type: 'UMLClassDiagram',
	_id: id,
	name: id,
	ownedViews: views,
	...extra
});
const nodeView = (
	id: string,
	modelId: string,
	[left, top, width, height]: number[],
	extra: J = {}
): J => ({
	_type: 'UMLClassView',
	_id: id,
	model: ref(modelId),
	left,
	top,
	width,
	height,
	...extra
});
const edgeView = (
	type: string,
	id: string,
	modelId: string,
	tail: string,
	head: string,
	points: string,
	extra: J = {}
): J => ({
	_type: type,
	_id: id,
	model: ref(modelId),
	tail: ref(tail),
	head: ref(head),
	points,
	...extra
});
const el = (r: ReturnType<typeof parseMdj>, id: string) => r.project.elements.get(id) as Element;
const C = (r: ReturnType<typeof parseMdj>, id: string) => el(r, id) as Classifier;
const R = (r: ReturnType<typeof parseMdj>, id: string) => el(r, id) as Relationship;
const unknownsOf = (r: ReturnType<typeof parseMdj>) =>
	r.unknown.filter((u) => u.path !== SOURCE_PATH);

describe('Project', () => {
	it('maps id and name; anything beside the models is an Unknown at its place, byte-identical', () => {
		const profile = {
			_type: 'UMLProfile',
			_id: 'X',
			name: 'Prof',
			ownedElements: [{ _type: 'UMLStereotype', _id: 'S', name: 'entity' }]
		};
		const source = doc([profile, model([])], { author: 'me' });
		const before = JSON.stringify(source);
		const r = parseMdj(source);
		expect(r.project).toMatchObject({ id: 'P', name: 'Proj' });
		expect(unknownsOf(r)).toEqual([
			{ json: profile, parentId: 'P', path: 'ownedElements', index: 0 }
		]);
		expect(unknownsOf(r)[0].json).toBe(profile);
		expect(JSON.stringify(source)).toBe(before);
		// Fields the model does not hold, like `author`, stay in the project's #source record.
		expect(r.unknown.find((u) => u.parentId === 'P' && u.path === SOURCE_PATH)?.json).toMatchObject(
			{ author: 'me' }
		);
		expect(
			r.unknown.find((u) => u.parentId === 'P' && u.path === SOURCE_PATH)?.json
		).not.toHaveProperty('ownedElements');
	});

	it('rejects anything that is not a StarUML project', () => {
		expect(() => parseMdj({ _type: 'UMLModel', _id: 'x' })).toThrow(MdjError);
		expect(() => parseMdj([])).toThrow(MdjError);
		expect(() => parseMdjText('{nope')).toThrow('not valid JSON');
		expect(parseMdjText('\uFEFF' + JSON.stringify(one([]))).project.id).toBe('P');
	});
});

describe('UMLModel', () => {
	it('folds the first model into the project; later models become packages so their content shows', () => {
		const r = parseMdj(
			doc([model([cls('A')]), model([cls('B'), diagram('D2', [])], 'M2', 'Second')])
		);
		expect(C(r, 'A').packageId).toBeUndefined();
		expect(r.project.elements.has('M')).toBe(false);
		expect(el(r, 'M2')).toMatchObject({ kind: 'package', name: 'Second', memberIds: ['B'] });
		expect(C(r, 'B').packageId).toBe('M2');
		expect(r.project.diagrams.map((d) => d.id)).toEqual(['D2']);
	});
});

describe('UMLClassDiagram', () => {
	it('every class diagram becomes a diagram, in document order, with StarUML view defaults', () => {
		const r = parseMdj(
			one([diagram('D1', [], { defaultDiagram: true }), cls('A'), diagram('D2', [])])
		);
		expect(r.project.diagrams.map((d) => [d.id, d.name, d.diagramKind])).toEqual([
			['D1', 'D1', 'class'],
			['D2', 'D2', 'class']
		]);
		expect(r.project.diagrams[0].defaults).toEqual(STARUML_VIEW_DEFAULTS);
		expect(r.report.diagrams.map((d) => d.name)).toEqual(['D1', 'D2']);
	});
});

describe('UMLPackage', () => {
	it('nests; classifiers in a package get its packageId', () => {
		const r = parseMdj(
			one([
				{
					_type: 'UMLPackage',
					_id: 'K',
					name: 'core',
					ownedElements: [
						cls('A'),
						{ _type: 'UMLPackage', _id: 'K2', name: 'inner', ownedElements: [cls('B')] }
					]
				}
			])
		);
		expect(el(r, 'K')).toMatchObject({ kind: 'package', name: 'core', memberIds: ['A', 'K2'] });
		expect(el(r, 'K2')).toMatchObject({ parentId: 'K', memberIds: ['B'] });
		expect(C(r, 'B').packageId).toBe('K2');
	});
});

describe('UMLClass, UMLInterface, UMLEnumeration, UMLDataType, UMLPrimitiveType', () => {
	it('map to classifiers of the right kind with their fields; stereotypes may be refs to a name', () => {
		const profile = {
			_type: 'UMLProfile',
			_id: 'X',
			ownedElements: [{ _type: 'UMLStereotype', _id: 'S', name: 'entity' }]
		};
		const r = parseMdj(
			doc([
				profile,
				model([
					cls('A', {
						isAbstract: true,
						isLeaf: true,
						visibility: 'package',
						stereotype: ref('S'),
						documentation: 'doc'
					}),
					{ _type: 'UMLInterface', _id: 'I', name: 'I', stereotype: 'service' },
					{
						_type: 'UMLEnumeration',
						_id: 'E',
						name: 'E',
						literals: [
							{ _type: 'UMLEnumerationLiteral', _id: 'L1', name: 'ON', stereotype: 'default' },
							{ _type: 'UMLEnumerationLiteral', _id: 'L2', name: 'OFF' }
						]
					},
					{ _type: 'UMLDataType', _id: 'DT', name: 'Money' },
					{ _type: 'UMLPrimitiveType', _id: 'PT', name: 'int' }
				])
			])
		);
		expect(C(r, 'A')).toEqual({
			kind: 'classifier',
			id: 'A',
			classifierKind: 'class',
			name: 'A',
			isAbstract: true,
			isLeaf: true,
			visibility: 'package',
			stereotype: 'entity',
			documentation: 'doc',
			attributes: [],
			operations: [],
			literals: []
		});
		expect(C(r, 'I')).toMatchObject({
			classifierKind: 'interface',
			stereotype: 'service',
			visibility: 'public',
			isAbstract: false
		});
		expect(C(r, 'E').literals).toEqual([
			{ id: 'L1', name: 'ON', stereotype: 'default', documentation: '' },
			{ id: 'L2', name: 'OFF', documentation: '' }
		]);
		expect(C(r, 'DT')).toMatchObject({ classifierKind: 'dataType' });
		expect(C(r, 'DT')).not.toHaveProperty('stereotype');
		expect(C(r, 'PT')).toMatchObject({ classifierKind: 'dataType', stereotype: 'primitive' });
	});
});

describe('UMLAttribute', () => {
	it('maps every field; a type may be a ref to a classifier name; empty strings are unset', () => {
		const r = parseMdj(
			one([
				cls('Book'),
				cls('A', {
					attributes: [
						{
							_type: 'UMLAttribute',
							_id: 'a1',
							name: 'title',
							type: 'String',
							visibility: 'private',
							multiplicity: '1',
							defaultValue: '"x"',
							isStatic: true,
							isReadOnly: true,
							isDerived: true,
							stereotype: 'key',
							documentation: 'd'
						},
						{
							_type: 'UMLAttribute',
							_id: 'a2',
							name: 'book',
							type: ref('Book'),
							multiplicity: '',
							defaultValue: ''
						},
						{ _type: 'UMLAttribute', _id: 'a3', name: 'raw', type: '' }
					]
				})
			])
		);
		expect(C(r, 'A').attributes).toEqual([
			{
				id: 'a1',
				name: 'title',
				type: 'String',
				visibility: 'private',
				multiplicity: '1',
				defaultValue: '"x"',
				isStatic: true,
				isReadOnly: true,
				isDerived: true,
				stereotype: 'key',
				documentation: 'd'
			},
			{
				id: 'a2',
				name: 'book',
				type: 'Book',
				visibility: 'public',
				isStatic: false,
				isReadOnly: false,
				isDerived: false,
				documentation: ''
			},
			{
				id: 'a3',
				name: 'raw',
				visibility: 'public',
				isStatic: false,
				isReadOnly: false,
				isDerived: false,
				documentation: ''
			}
		]);
	});
});

describe('UMLOperation and UMLParameter', () => {
	it('maps parameters; a return-direction parameter becomes the return type', () => {
		const r = parseMdj(
			one([
				cls('Money'),
				cls('A', {
					operations: [
						{
							_type: 'UMLOperation',
							_id: 'o1',
							name: 'deposit',
							visibility: 'protected',
							isStatic: true,
							isAbstract: true,
							isQuery: true,
							stereotype: 'create',
							parameters: [
								{ _type: 'UMLParameter', _id: 'p1', name: 'amount', type: ref('Money') },
								{
									_type: 'UMLParameter',
									_id: 'p2',
									name: 'log',
									type: 'Log',
									direction: 'inout',
									defaultValue: 'null'
								},
								{ _type: 'UMLParameter', _id: 'p3', type: 'boolean', direction: 'return' }
							]
						},
						{ _type: 'UMLOperation', _id: 'o2', name: 'go' }
					]
				})
			])
		);
		expect(C(r, 'A').operations).toEqual([
			{
				id: 'o1',
				name: 'deposit',
				visibility: 'protected',
				returnType: 'boolean',
				stereotype: 'create',
				parameters: [
					{ name: 'amount', type: 'Money', direction: 'in' },
					{ name: 'log', type: 'Log', direction: 'inout', defaultValue: 'null' }
				],
				isStatic: true,
				isAbstract: true,
				isQuery: true,
				documentation: ''
			},
			{
				id: 'o2',
				name: 'go',
				visibility: 'public',
				parameters: [],
				isStatic: false,
				isAbstract: false,
				isQuery: false,
				documentation: ''
			}
		]);
	});
});

describe('UMLAssociation', () => {
	const end = (id: string, refTo: string, extra: J = {}): J => ({
		_type: 'UMLAssociationEnd',
		_id: id,
		reference: ref(refTo),
		...extra
	});
	const assoc = (extra: J): J => ({ _type: 'UMLAssociation', _id: 'r', ...extra });

	it('maps ends: role, multiplicity, navigability (boolean or string), visibility, derived', () => {
		const r = parseMdj(
			one([
				cls('A', {
					ownedElements: [
						assoc({
							name: 'holds',
							end1: end('e1', 'A', {
								name: 'owner',
								multiplicity: '1',
								navigable: false,
								visibility: 'private'
							}),
							end2: end('e2', 'B', {
								name: 'items',
								multiplicity: '0..*',
								navigable: 'navigable',
								isDerived: true
							})
						})
					]
				}),
				cls('B')
			])
		);
		expect(R(r, 'r')).toEqual({
			kind: 'relationship',
			id: 'r',
			relationshipKind: 'association',
			sourceId: 'A',
			targetId: 'B',
			name: 'holds',
			documentation: '',
			sourceEnd: {
				role: 'owner',
				multiplicity: '1',
				navigable: 'notNavigable',
				visibility: 'private',
				isDerived: false,
				ownsOther: false
			},
			targetEnd: {
				role: 'items',
				multiplicity: '0..*',
				navigable: 'navigable',
				visibility: 'public',
				isDerived: true,
				ownsOther: false
			}
		});
		const unspecified = parseMdj(
			one([
				cls('A', {
					ownedElements: [
						assoc({
							end1: end('e1', 'A', { navigable: true }),
							end2: end('e2', 'B', { navigable: 'unspecified' })
						})
					]
				}),
				cls('B')
			])
		);
		expect(R(unspecified, 'r').sourceEnd?.navigable).toBe('navigable');
		expect(R(unspecified, 'r').targetEnd?.navigable).toBe('unspecified');
	});

	it('aggregation on an end sets the kind with the whole as target, swapping ends when it is end1', () => {
		const comp = parseMdj(
			one([
				cls('Part', {
					ownedElements: [
						assoc({
							end1: end('e1', 'Part', { multiplicity: '*' }),
							end2: end('e2', 'Whole', { aggregation: 'composite' })
						})
					]
				}),
				cls('Whole')
			])
		);
		expect(R(comp, 'r')).toMatchObject({
			relationshipKind: 'composition',
			sourceId: 'Part',
			targetId: 'Whole',
			sourceEnd: { multiplicity: '*' }
		});
		const agg = parseMdj(
			one([
				cls('Whole', {
					ownedElements: [
						assoc({
							end1: end('e1', 'Whole', { aggregation: 'shared', multiplicity: '1' }),
							end2: end('e2', 'Part', { name: 'parts' })
						})
					]
				}),
				cls('Part')
			])
		);
		expect(R(agg, 'r')).toMatchObject({
			relationshipKind: 'aggregation',
			sourceId: 'Part',
			targetId: 'Whole',
			sourceEnd: { role: 'parts' },
			targetEnd: { multiplicity: '1' }
		});
	});

	it('ownerAttribute on an end: the class at the other end owns it, so that end draws the dot', () => {
		const r = parseMdj(
			one([
				cls('A', {
					ownedElements: [
						assoc({ end1: end('e1', 'A'), end2: end('e2', 'B', { ownerAttribute: ref('attr') }) })
					]
				}),
				cls('B')
			])
		);
		expect(R(r, 'r').sourceEnd?.ownsOther).toBe(true);
		expect(R(r, 'r').targetEnd?.ownsOther).toBe(false);
	});
});

describe('UMLGeneralization, UMLInterfaceRealization, UMLRealization, UMLDependency', () => {
	it('map source and target; realizations of both kinds are realization; dependency keeps its stereotype', () => {
		const rel = (type: string, id: string, s: string, t: string, extra: J = {}): J => ({
			_type: type,
			_id: id,
			source: ref(s),
			target: ref(t),
			...extra
		});
		const r = parseMdj(
			one([
				cls('Child', {
					ownedElements: [
						rel('UMLGeneralization', 'g', 'Child', 'Parent'),
						rel('UMLInterfaceRealization', 'ir', 'Child', 'I'),
						rel('UMLRealization', 'rz', 'Child', 'I'),
						rel('UMLDependency', 'dep', 'Child', 'Parent', { stereotype: 'use', name: 'uses' })
					]
				}),
				cls('Parent'),
				{ _type: 'UMLInterface', _id: 'I', name: 'I' }
			])
		);
		expect(R(r, 'g')).toMatchObject({
			relationshipKind: 'generalization',
			sourceId: 'Child',
			targetId: 'Parent'
		});
		expect(R(r, 'g')).not.toHaveProperty('sourceEnd');
		expect(R(r, 'ir')).toMatchObject({ relationshipKind: 'realization', targetId: 'I' });
		expect(R(r, 'rz')).toMatchObject({ relationshipKind: 'realization', targetId: 'I' });
		expect(R(r, 'dep')).toMatchObject({
			relationshipKind: 'dependency',
			stereotype: 'use',
			name: 'uses'
		});
	});

	it('a relationship to something Aster does not model is kept whole as an Unknown, with a warning', () => {
		const dep = {
			_type: 'UMLDependency',
			_id: 'dep',
			source: { $ref: 'A' },
			target: { $ref: 'Act' }
		};
		const r = parseMdj(
			one([cls('A', { ownedElements: [dep] }), { _type: 'UMLActor', _id: 'Act', name: 'User' }])
		);
		expect(r.project.elements.has('dep')).toBe(false);
		expect(unknownsOf(r)).toContainEqual({
			json: dep,
			parentId: 'A',
			path: 'ownedElements',
			index: 0
		});
		expect(r.report.warnings).toContainEqual({
			code: 'relationshipEndpoint',
			type: 'UMLDependency',
			name: 'dep'
		});
		expect(r.unknown.some((u) => u.parentId === 'dep' && u.path === SOURCE_PATH)).toBe(false);
	});
});

describe('Unknown types (constraints, association-class links, templates …)', () => {
	it('are kept verbatim at their parent and array position, wherever they sit', () => {
		const constraint = { _type: 'UMLConstraint', _id: 'k', specification: 'x > 0' };
		const link = { _type: 'UMLAssociationClassLink', _id: 'acl' };
		const tag = { _type: 'Tag', _id: 't', name: 'since' };
		const r = parseMdj(
			one([
				cls('A', {
					ownedElements: [constraint],
					attributes: [{ _type: 'UMLAttribute', _id: 'a', name: 'x', ownedElements: [tag] }]
				}),
				link
			])
		);
		expect(unknownsOf(r)).toEqual([
			{ json: tag, parentId: 'a', path: 'ownedElements', index: 0 },
			{ json: constraint, parentId: 'A', path: 'ownedElements', index: 0 },
			{ json: link, parentId: 'M', path: 'ownedElements', index: 1 }
		]);
		expect(r.report.unknownElements).toBe(3);
		expect(r.report.unknownTypes).toEqual({ Tag: 1, UMLConstraint: 1, UMLAssociationClassLink: 1 });
	});

	it('diagrams Aster does not show are listed as kept but hidden', () => {
		const collab = {
			_type: 'UMLCollaboration',
			_id: 'co',
			name: 'C',
			ownedElements: [
				{
					_type: 'UMLInteraction',
					_id: 'in',
					ownedElements: [{ _type: 'UMLSequenceDiagram', _id: 'sd', name: 'Login' }]
				}
			]
		};
		const r = parseMdj(
			doc([model([{ _type: 'UMLUseCaseDiagram', _id: 'ud', name: 'Cases' }]), collab])
		);
		expect(r.report.hiddenDiagrams).toEqual([
			{ type: 'UMLUseCaseDiagram', name: 'Cases' },
			{ type: 'UMLSequenceDiagram', name: 'Login' }
		]);
	});
});

describe('UMLNoteView, UMLNoteLinkView, UMLTextView', () => {
	it('become notes and text with node layouts; note links list what the note is linked to', () => {
		const r = parseMdj(
			one([
				cls('A'),
				diagram('D', [
					nodeView('vA', 'A', [10, 10, 100, 50]),
					{
						_type: 'UMLNoteView',
						_id: 'n',
						text: 'remember',
						left: 200,
						top: 10,
						width: 120,
						height: 60
					},
					{
						_type: 'UMLTextView',
						_id: 'tx',
						text: 'Title',
						left: 0,
						top: 300,
						width: 60,
						height: 15
					},
					{
						_type: 'UMLNoteLinkView',
						_id: 'nl',
						tail: ref('n'),
						head: ref('vA'),
						points: '200:40;110:35',
						lineStyle: 1
					}
				])
			])
		);
		expect(el(r, 'n')).toEqual({
			kind: 'note',
			id: 'n',
			text: 'remember',
			linkedIds: ['A']
		} satisfies Note);
		expect(el(r, 'tx')).toEqual({ kind: 'text', id: 'tx', text: 'Title' });
		const d = r.project.diagrams[0];
		expect(d.layout.get('n')).toMatchObject({ kind: 'node', x: 200, y: 10, w: 120, h: 60 });
		expect(d.elementIds).toEqual(['A', 'n', 'tx']);
		expect(
			r.unknown.find((u) => u.parentId === 'nl' && u.path === SOURCE_PATH)?.json
		).toMatchObject({ points: '200:40;110:35' });
		expect(r.report.diagrams[0]).toMatchObject({ nodes: 1, notes: 1, texts: 1 });
	});
});

describe('classifier views (UMLClassView, UMLInterfaceView, UMLEnumerationView, UMLDataTypeView, UMLPackageView)', () => {
	it('left/top/width/height, fill and line colours, and only the flags that differ from StarUML defaults', () => {
		const r = parseMdj(
			one([
				cls('A'),
				{ _type: 'UMLEnumeration', _id: 'E', name: 'E' },
				diagram('D', [
					nodeView('vA', 'A', [120, 80, 200, 150], {
						fillColor: '#ffffe0',
						lineColor: '#333333',
						showVisibility: false,
						showType: true,
						suppressOperations: true,
						stereotypeDisplay: 'none',
						autoResize: false,
						showProperty: true,
						font: 'Arial;13;0'
					}),
					{
						_type: 'UMLEnumerationView',
						_id: 'vE',
						model: ref('E'),
						left: 5,
						top: 6,
						width: 7,
						height: 8,
						suppressLiterals: true
					}
				])
			])
		);
		const d = r.project.diagrams[0];
		expect(d.layout.get('A')).toEqual({
			kind: 'node',
			x: 120,
			y: 80,
			w: 200,
			h: 150,
			fill: '#ffffe0',
			line: '#333333',
			flags: { showVisibility: false, suppressOperations: true, stereotypeDisplay: 'none' }
		} satisfies NodeLayout);
		expect(d.layout.get('E')).toEqual({
			kind: 'node',
			x: 5,
			y: 6,
			w: 7,
			h: 8,
			flags: { suppressLiterals: true }
		});
		// Unmapped view fields such as `font` stay in the view's #source record.
		expect(
			r.unknown.find((u) => u.parentId === 'vA' && u.path === SOURCE_PATH)?.json
		).toMatchObject({ font: 'Arial;13;0' });
	});

	it('containerView puts the element in that package; a disagreement with ownership is a warning', () => {
		const r = parseMdj(
			one([
				{ _type: 'UMLPackage', _id: 'K', name: 'core', ownedElements: [cls('In')] },
				cls('Out'),
				diagram('D', [
					{
						_type: 'UMLPackageView',
						_id: 'vK',
						model: ref('K'),
						left: 0,
						top: 0,
						width: 400,
						height: 300
					},
					nodeView('vIn', 'In', [20, 40, 100, 50], { containerView: ref('vK') }),
					nodeView('vOut', 'Out', [200, 40, 100, 50], { containerView: ref('vK') })
				])
			])
		);
		expect((el(r, 'K') as Package).memberIds).toEqual(['In', 'Out']);
		expect(r.report.warnings).toEqual([
			{ code: 'containerMismatch', diagram: 'D', element: 'Out', package: 'core' }
		]);
		expect(r.project.diagrams[0].layout.get('K')).toMatchObject({ kind: 'node', w: 400 });
	});

	it('a view without a resolvable model is not placed (kept, with a warning); a model without a view stays in the model', () => {
		const ghost = nodeView('vX', 'missing', [0, 0, 10, 10]);
		const r = parseMdj(
			one([
				cls('A'),
				cls('Lonely'),
				diagram('D', [
					nodeView('vA', 'A', [0, 0, 10, 10]),
					ghost,
					nodeView('vA2', 'A', [50, 0, 10, 10])
				])
			])
		);
		const d = r.project.diagrams[0];
		expect(d.elementIds).toEqual(['A']);
		expect(r.project.elements.has('Lonely')).toBe(true);
		expect(r.report.warnings).toEqual([
			{ code: 'viewWithoutModel', diagram: 'D', type: 'UMLClassView' },
			{ code: 'duplicateView', diagram: 'D', element: 'A' }
		]);
		expect(unknownsOf(r).map((u) => [u.json, u.parentId, u.path, u.index])).toContainEqual([
			ghost,
			'D',
			'ownedViews',
			1
		]);
		expect(r.report.diagrams[0].hiddenViews).toBe(2);
	});
});

describe('edge views and EdgeLabelView', () => {
	const two = (
		views: J[],
		owned: J[] = [{ _type: 'UMLDependency', _id: 'r', source: ref('A'), target: ref('B') }]
	) =>
		parseMdj(
			one([
				cls('A', { ownedElements: owned }),
				cls('B'),
				diagram('D', [
					nodeView('vA', 'A', [0, 0, 100, 50]),
					nodeView('vB', 'B', [300, 0, 100, 50]),
					...views
				])
			])
		);

	it('points become waypoints without the two border endpoints; lineStyle 0–3 maps, absent is oblique', () => {
		for (const [style, name] of [
			[0, 'rectilinear'],
			[1, 'oblique'],
			[2, 'roundrect'],
			[3, 'curve'],
			[undefined, 'oblique']
		] as const) {
			const r = two([
				edgeView(
					'UMLDependencyView',
					'vr',
					'r',
					'vA',
					'vB',
					'100:25;150:25;150:80;250:80;300:25',
					style === undefined ? {} : { lineStyle: style, lineColor: '#ff0000' }
				)
			]);
			const layout = r.project.diagrams[0].layout.get('r') as EdgeLayout;
			expect(layout.lineStyle).toBe(name);
			expect(layout.waypoints).toEqual([
				{ x: 150, y: 25 },
				{ x: 150, y: 80 },
				{ x: 250, y: 80 }
			]);
			if (style !== undefined) expect(layout.line).toBe('#ff0000');
		}
		expect(parsePoints('1:2;3.5:-4;bad')).toEqual([
			{ x: 1, y: 2 },
			{ x: 3.5, y: -4 }
		]);
	});

	it('label views give label offsets, keyed by the edge’s label references (tail = source)', () => {
		const lab = (id: string, alpha: number, distance: number) => ({
			_type: 'EdgeLabelView',
			_id: id,
			alpha,
			distance,
			edgePosition: 0
		});
		const r = two(
			[
				edgeView('UMLAssociationView', 'vr', 'r', 'vA', 'vB', '100:25;300:25', {
					subViews: [
						lab('l1', 1.5, 15),
						lab('l2', 0.5, 30),
						lab('l3', -0.5, 25),
						lab('l4', -0.6, 31),
						lab('l5', 0.6, 26)
					],
					nameLabel: ref('l1'),
					tailRoleNameLabel: ref('l2'),
					tailMultiplicityLabel: ref('l3'),
					headRoleNameLabel: ref('l4'),
					headMultiplicityLabel: ref('l5')
				})
			],
			[
				{
					_type: 'UMLAssociation',
					_id: 'r',
					end1: { _id: 'e1', reference: ref('A') },
					end2: { _id: 'e2', reference: ref('B') }
				}
			]
		);
		expect((r.project.diagrams[0].layout.get('r') as EdgeLayout).labelOffsets).toEqual({
			name: { alpha: 1.5, distance: 15 },
			sourceRole: { alpha: 0.5, distance: 30 },
			sourceMultiplicity: { alpha: -0.5, distance: 25 },
			targetRole: { alpha: -0.6, distance: 31 },
			targetMultiplicity: { alpha: 0.6, distance: 26 }
		});
	});

	it('an association swapped to keep the whole as target reverses its waypoints and swaps its end labels', () => {
		const lab = (id: string, alpha: number, distance: number) => ({
			_type: 'EdgeLabelView',
			_id: id,
			alpha,
			distance
		});
		const r = parseMdj(
			one([
				cls('Whole', {
					ownedElements: [
						{
							_type: 'UMLAssociation',
							_id: 'r',
							end1: { _id: 'e1', reference: ref('Whole'), aggregation: 'composite' },
							end2: { _id: 'e2', reference: ref('Part') }
						}
					]
				}),
				cls('Part'),
				diagram('D', [
					nodeView('vW', 'Whole', [0, 0, 100, 50]),
					nodeView('vP', 'Part', [300, 0, 100, 50]),
					edgeView('UMLAssociationView', 'vr', 'r', 'vW', 'vP', '100:25;150:10;250:40;300:25', {
						subViews: [lab('n', Math.PI / 2, 15), lab('t', 0.5, 30)],
						nameLabel: ref('n'),
						tailRoleNameLabel: ref('t')
					})
				])
			])
		);
		const layout = r.project.diagrams[0].layout.get('r') as EdgeLayout;
		expect(R(r, 'r')).toMatchObject({ sourceId: 'Part', targetId: 'Whole' });
		expect(layout.waypoints).toEqual([
			{ x: 250, y: 40 },
			{ x: 150, y: 10 }
		]);
		expect(layout.labelOffsets.targetRole).toEqual({ alpha: 0.5, distance: 30 });
		expect(layout.labelOffsets.name?.alpha).toBeCloseTo(-Math.PI / 2);
		expect(r.report.warnings).toEqual([]);
	});

	it('head and tail are cross-checked against the model; edges whose nodes are not shown are kept with a warning', () => {
		const flipped = two([edgeView('UMLDependencyView', 'vr', 'r', 'vB', 'vA', '300:25;100:25')]);
		expect(flipped.report.warnings).toEqual([
			{ code: 'headTailMismatch', diagram: 'D', relationship: 'r' }
		]);
		const r = parseMdj(
			one([
				cls('A', {
					ownedElements: [{ _type: 'UMLDependency', _id: 'r', source: ref('A'), target: ref('B') }]
				}),
				cls('B'),
				diagram('D', [
					nodeView('vA', 'A', [0, 0, 10, 10]),
					edgeView('UMLDependencyView', 'vr', 'r', 'vA', 'nowhere', '0:0;1:1')
				])
			])
		);
		expect(r.report.warnings).toEqual([
			{ code: 'edgeEndNotShown', diagram: 'D', relationship: 'r' }
		]);
		expect(r.project.diagrams[0].layout.get('r')?.kind).toBe('edge');
	});

	it('views of things Aster does not draw are kept in place and counted per diagram', () => {
		const cv = { _type: 'UMLConstraintView', _id: 'cv', left: 1 };
		const r = two([cv]);
		expect(unknownsOf(r)).toContainEqual({ json: cv, parentId: 'D', path: 'ownedViews', index: 2 });
		expect(r.report.diagrams[0]).toMatchObject({ nodes: 2, edges: 0, hiddenViews: 1 });
	});
});

describe('#source records', () => {
	it('every mapped object keeps its own fields, without the child arrays the walk descends into', () => {
		const r = parseMdj(
			one([
				cls('A', {
					isActive: true,
					attributes: [{ _type: 'UMLAttribute', _id: 'a', name: 'x', isID: true }]
				})
			])
		);
		const own = (id: string) =>
			r.unknown.find((u) => u.parentId === id && u.path === SOURCE_PATH)?.json as J;
		expect(own('A')).toEqual({ _type: 'UMLClass', _id: 'A', name: 'A', isActive: true });
		expect(own('a')).toMatchObject({ isID: true });
		expect(own('M')).not.toHaveProperty('ownedElements');
		expect(r.report.unknownElements).toBe(0);
		expect([...r.project.importedIds].sort()).toEqual(['A']);
	});
});

describe('containers and arrays the table does not name', () => {
	it('a UMLSubsystem owns classes like a package, so their views are placed', () => {
		const sub = { _type: 'UMLSubsystem', _id: 'S', name: 'core', ownedElements: [cls('A')] };
		const r = parseMdj(
			one([
				sub,
				diagram('D', [
					{
						_type: 'UMLSubsystemView',
						_id: 'vS',
						model: ref('S'),
						left: 0,
						top: 0,
						width: 300,
						height: 200
					},
					nodeView('vA', 'A', [10, 30, 100, 50], { containerView: ref('vS') })
				])
			])
		);
		expect(el(r, 'S')).toMatchObject({ kind: 'package', memberIds: ['A'] });
		expect(C(r, 'A').packageId).toBe('S');
		expect(r.project.diagrams[0].elementIds).toEqual(['S', 'A']);
		expect(r.report.warnings).toEqual([]);
	});

	it('other arrays of typed objects on model elements become Unknowns at that path; their records leave them out', () => {
		const reception = { _type: 'UMLReception', _id: 'rc', name: 'ping' };
		const tp = { _type: 'UMLTemplateParameter', _id: 'tp', name: 'T' };
		const tag = { _type: 'Tag', _id: 'tg', name: 'x' };
		const r = parseMdj(
			one([
				cls('A', {
					receptions: [reception],
					templateParameters: [tp],
					ownedElements: [
						{
							_type: 'UMLDependency',
							_id: 'd',
							source: ref('A'),
							target: ref('A'),
							ownedElements: [tag]
						}
					]
				})
			])
		);
		expect(unknownsOf(r)).toEqual(
			expect.arrayContaining([
				{ json: reception, parentId: 'A', path: 'receptions', index: 0 },
				{ json: tp, parentId: 'A', path: 'templateParameters', index: 0 },
				{ json: tag, parentId: 'd', path: 'ownedElements', index: 0 }
			])
		);
		const own = r.unknown.find((u) => u.parentId === 'A' && u.path === SOURCE_PATH)?.json as J;
		expect(own).not.toHaveProperty('receptions');
		expect(own).not.toHaveProperty('templateParameters');
		expect(R(r, 'd').relationshipKind).toBe('dependency');
	});
});
