/**
 * Object diagrams (features.md M3.2): "An object diagram references classes from the class
 * diagram and exports to UMLObjectDiagram". The ATM fixture's object diagram reads as objects,
 * slots and links; a new one writes StarUML's types; an edit changes only what it touches.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdj } from '#lib/mdj/serialize.ts';
import {
	createClassifier,
	createDiagram,
	createInstance,
	createLink,
	createProject,
	createSlot,
	defaultEdgeLayout,
	defaultNodeLayout,
	instanceLabel
} from '#lib/model/project.ts';
import type { Instance, Link } from '#lib/model/types.ts';
import { jsonDiff } from './helpers.ts';

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null && !Array.isArray(v);
function all(o: unknown, out: J[] = []): J[] {
	if (Array.isArray(o)) o.forEach((v) => all(v, out));
	else if (isObj(o)) {
		out.push(o);
		for (const [k, v] of Object.entries(o)) if (k !== '_parent') all(v, out);
	}
	return out;
}
const atm = readFileSync(
	new URL('../../fixtures/mdj/public-atm-object.mdj', import.meta.url),
	'utf8'
);

describe('object diagrams in .mdj', () => {
	it('reads the ATM object diagram as objects with slots and links between them', () => {
		const { project, report } = parseMdjText(atm);
		const diagram = project.diagrams.find((d) => d.diagramKind === 'object')!;
		expect(diagram).toBeDefined();
		const objects = [...project.elements.values()].filter(
			(e): e is Instance => e.kind === 'instance'
		);
		const links = [...project.elements.values()].filter((e): e is Link => e.kind === 'link');
		expect(objects.map((o) => instanceLabel(o)).sort()).toMatchSnapshot();
		const atm1 = objects.find((o) => o.name === 'atm1')!;
		expect(atm1.classifier).toBe('ATM');
		expect(atm1.slots.map((s) => `${s.name} = ${s.value}`)).toEqual([
			'location = "Chennai"',
			'bankName = "SBI"',
			'balance = 500000'
		]);
		expect(links.length).toBeGreaterThan(0);
		for (const l of links) {
			expect(project.elements.get(l.sourceId)?.kind).toBe('instance');
			expect(project.elements.get(l.targetId)?.kind).toBe('instance');
		}
		// Every object and link is on the diagram; the diagram is no longer "kept but not shown".
		for (const e of [...objects, ...links]) expect(diagram.layout.has(e.id)).toBe(true);
		expect(report.hiddenDiagrams.map((h) => h.type)).not.toContain('UMLObjectDiagram');
	});

	it('changes only the slot it edits, and that slot view text', () => {
		const json = JSON.parse(atm) as J;
		const { project } = parseMdjText(atm);
		const atm1 = [...project.elements.values()].find(
			(e): e is Instance => e.kind === 'instance' && e.name === 'atm1'
		)!;
		atm1.slots[2].value = '750000';
		const diff = jsonDiff(json, serializeMdj(project));
		expect(diff.length).toBe(2);
		expect(diff.some((d) => d.includes('"500000" vs "750000"'))).toBe(true);
		expect(diff.some((d) => d.includes('"+balance = 500000" vs "+balance = 750000"'))).toBe(true);
	});

	it('writes a new object diagram as StarUML does, and reads it back the same', () => {
		const project = createProject({ id: 'p', name: 'Bank' });
		const classes = createDiagram({ id: 'cd', name: 'Classes' });
		const objects = createDiagram({ id: 'od', name: 'Objects', diagramKind: 'object' });
		project.diagrams.push(classes, objects);
		const account = createClassifier({ id: 'Account', name: 'Account' });
		project.elements.set(account.id, account);
		classes.elementIds.push(account.id);
		classes.layout.set(account.id, defaultNodeLayout(40, 40));
		const a = createInstance({
			id: 'a',
			name: 'acc',
			classifier: 'Account',
			slots: [createSlot('balance', '100', 's1')]
		});
		const b = createInstance({ id: 'b', name: '', classifier: 'Customer' });
		const l = createLink({ id: 'l', sourceId: 'b', targetId: 'a', name: 'owns' });
		for (const [e, x] of [
			[a, 40],
			[b, 320]
		] as const) {
			project.elements.set(e.id, e);
			objects.elementIds.push(e.id);
			objects.layout.set(e.id, defaultNodeLayout(x, 40));
		}
		project.elements.set(l.id, l);
		objects.elementIds.push(l.id);
		objects.layout.set(l.id, defaultEdgeLayout());

		const out = serializeMdj(project);
		const byType = (t: string) => all(out).filter((o) => o._type === t);
		expect(byType('UMLObjectDiagram').map((d) => d.name)).toEqual(['Objects']);
		const [acc] = byType('UMLObject').filter((o) => o.name === 'acc');
		// The class exists: its $ref; a class that does not (Customer) stays a name.
		expect(acc.classifier).toEqual({ $ref: 'Account' });
		expect(byType('UMLObject').find((o) => o._id === 'b')!.classifier).toBe('Customer');
		expect(byType('UMLSlot').map((s) => [s.name, s.value])).toEqual([['balance', '100']]);
		const [link] = byType('UMLLink');
		expect((link.end1 as J).reference).toEqual({ $ref: 'b' });
		expect((link.end2 as J).reference).toEqual({ $ref: 'a' });
		expect(byType('UMLObjectView')).toHaveLength(2);
		expect(byType('UMLLinkView')).toHaveLength(1);
		expect(byType('UMLSlotView').map((v) => v.text)).toEqual(['+balance = 100']);
		expect(all(out).find((o) => o._type === 'LabelView' && o.underline === true)?.text).toBe(
			'acc: Account'
		);

		const back = parseMdjText(JSON.stringify(out)).project;
		expect(back.elements.get('a')).toEqual(a);
		expect(back.elements.get('b')).toEqual(b);
		expect(back.elements.get('l')).toEqual(l);
		expect(back.diagrams.find((d) => d.id === 'od')?.diagramKind).toBe('object');
	});
});
