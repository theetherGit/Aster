/**
 * A large StarUML file for the performance tests (features.md, Performance): `classes`
 * classes in a grid with attributes and operations, `edges` relationships between them, every
 * one with a view. Generated, not a golden fixture; `fixtures/perf/*.mdj` is git-ignored.
 */
type Json = Record<string, unknown>;

export function largeMdj(classes = 200, edges = 300): Json {
	let n = 0;
	const id = (prefix: string) => `${prefix}${(n++).toString(36).padStart(4, '0')}`;
	const ref = (x: string) => ({ $ref: x });
	const projectId = 'perf-project';
	const modelId = 'perf-model';
	const diagramId = 'perf-diagram';
	const cols = Math.ceil(Math.sqrt(classes * 1.6));
	const classJson: Json[] = [];
	const views: Json[] = [];
	const viewOf = new Map<string, string>();
	for (let i = 0; i < classes; i++) {
		const cid = id('c');
		const vid = id('v');
		viewOf.set(cid, vid);
		const left = 40 + (i % cols) * 240;
		const top = 40 + Math.floor(i / cols) * 180;
		classJson.push({
			_type: 'UMLClass',
			_id: cid,
			_parent: ref(modelId),
			name: `Class${i}`,
			attributes: Array.from({ length: 4 }, (_, a) => ({
				_type: 'UMLAttribute',
				_id: id('a'),
				_parent: ref(cid),
				name: `field${a}`,
				type: a % 2 ? 'int' : 'String',
				visibility: a % 3 ? 'private' : 'protected'
			})),
			operations: Array.from({ length: 3 }, (_, o) => ({
				_type: 'UMLOperation',
				_id: id('o'),
				_parent: ref(cid),
				name: `op${o}`,
				parameters: [
					{
						_type: 'UMLParameter',
						_id: id('p'),
						_parent: ref(''),
						type: 'void',
						direction: 'return'
					}
				]
			})),
			ownedElements: []
		});
		views.push({
			_type: 'UMLClassView',
			_id: vid,
			_parent: ref(diagramId),
			model: ref(cid),
			font: 'Arial;13;0',
			left,
			top,
			width: 180,
			height: 140
		});
	}
	// Relationships owned by their source class, each with an edge view.
	const centre = (cid: string) => {
		const v = views.find((x) => x._id === viewOf.get(cid))!;
		return { x: (v.left as number) + 90, y: (v.top as number) + 70 };
	};
	for (let e = 0; e < edges; e++) {
		const a = classJson[e % classes];
		const b = classJson[(e * 7 + 1) % classes];
		if (a === b) continue;
		const aid = a._id as string;
		const bid = b._id as string;
		const rid = id('r');
		const generalization = e % 3 === 0;
		(a.ownedElements as Json[]).push(
			generalization
				? {
						_type: 'UMLGeneralization',
						_id: rid,
						_parent: ref(aid),
						source: ref(aid),
						target: ref(bid)
					}
				: {
						_type: 'UMLAssociation',
						_id: rid,
						_parent: ref(aid),
						end1: {
							_type: 'UMLAssociationEnd',
							_id: id('e'),
							_parent: ref(rid),
							reference: ref(aid),
							multiplicity: '1'
						},
						end2: {
							_type: 'UMLAssociationEnd',
							_id: id('e'),
							_parent: ref(rid),
							reference: ref(bid),
							multiplicity: '0..*',
							navigable: 'navigable'
						}
					}
		);
		const pa = centre(aid);
		const pb = centre(bid);
		views.push({
			_type: generalization ? 'UMLGeneralizationView' : 'UMLAssociationView',
			_id: id('w'),
			_parent: ref(diagramId),
			model: ref(rid),
			font: 'Arial;13;0',
			tail: ref(viewOf.get(aid)!),
			head: ref(viewOf.get(bid)!),
			lineStyle: 1,
			points: `${pa.x}:${pa.y};${pb.x}:${pb.y}`
		});
	}
	// Return-parameter parents point at their operation.
	for (const c of classJson)
		for (const op of c.operations as Json[])
			for (const p of op.parameters as Json[]) p._parent = ref(op._id as string);
	return {
		_type: 'Project',
		_id: projectId,
		name: 'Performance',
		ownedElements: [
			{
				_type: 'UMLModel',
				_id: modelId,
				_parent: ref(projectId),
				name: 'Model',
				ownedElements: [
					{
						_type: 'UMLClassDiagram',
						_id: diagramId,
						_parent: ref(modelId),
						name: 'Large',
						defaultDiagram: true,
						ownedViews: views
					},
					...classJson
				]
			}
		]
	};
}

// `node fixtures/perf/generate.ts` writes fixtures/perf/large.mdj for manual runs.
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('generate.ts')) {
	const { writeFileSync } = await import('node:fs');
	writeFileSync(new URL('./large.mdj', import.meta.url), JSON.stringify(largeMdj(), null, '\t'));
	console.log('fixtures/perf/large.mdj written');
}
