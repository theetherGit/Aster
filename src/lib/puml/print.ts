/**
 * The Text view's printer: a diagram as PlantUML, in the form the spec's example has (board 09,
 * accessibility.md): classifiers in diagram order, a blank line, relationships, notes. Members are
 * Aster's UML text with the visibility symbol against the name, as PlantUML wants it.
 */
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import type { Classifier, Diagram, End, Id, Project, Relationship } from '#lib/model/types.ts';

const PLAIN = /^[A-Za-z_$][\w$]*$/;
export const pumlName = (name: string) => (PLAIN.test(name) ? name : `"${name}"`);

/** `+ name: Type` → `+name: Type`, `+ {static} x` → `{static} +x` stays Aster's order (PlantUML reads both). */
const line = (kind: MemberKind, m: Parameters<typeof renderMember>[1]) =>
	renderMember(kind, m).replace(/^([+\-#~]) /, '$1');

function header(c: Classifier): string {
	const name = pumlName(c.name);
	const stereo = c.stereotype ? ` <<${c.stereotype}>>` : '';
	switch (c.classifierKind) {
		case 'interface':
			return `interface ${name}${stereo}`;
		case 'enum':
			return `enum ${name}${stereo}`;
		case 'dataType':
			return `class ${name} <<dataType>>${stereo}`;
		case 'primitiveType':
			return `class ${name} <<primitive>>${stereo}`;
		default:
			return `${c.isAbstract ? 'abstract class' : 'class'} ${name}${stereo}`;
	}
}

function block(c: Classifier): string[] {
	const head = header(c);
	const members = [
		...c.attributes.map((m) => line('attribute', m)),
		...c.operations.map((m) => line('operation', m))
	];
	if (c.classifierKind === 'enum' && !members.length) {
		return c.literals.length
			? [`${head} { ${c.literals.map((l) => line('literal', l)).join('; ')} }`]
			: [head];
	}
	const all = [...c.literals.map((l) => line('literal', l)), ...members];
	return all.length ? [`${head} {`, ...all.map((s) => `  ${s}`), '}'] : [head];
}

const mult = (e: End | undefined) => (e?.multiplicity ? ` "${e.multiplicity}"` : '');
const multAfter = (e: End | undefined) => (e?.multiplicity ? `"${e.multiplicity}" ` : '');
const nav = (e: End | undefined) => e?.navigable === 'navigable';

function relationship(r: Relationship, name: (id: Id) => string): string {
	const s = name(r.sourceId);
	const t = name(r.targetId);
	const label = r.stereotype ? ` : <<${r.stereotype}>>` : r.name ? ` : ${r.name}` : '';
	switch (r.relationshipKind) {
		case 'generalization':
			return `${s} --|> ${t}${label}`;
		case 'realization':
			return `${s} ..|> ${t}${label}`;
		case 'dependency':
			return `${s} ..> ${t}${label}`;
		case 'composition':
		case 'aggregation': {
			// The whole (target) on the left, its diamond against it.
			const d = r.relationshipKind === 'composition' ? '*' : 'o';
			return `${t}${mult(r.targetEnd)} ${d}-- ${multAfter(r.sourceEnd)}${s}${label}`;
		}
		default: {
			const arrow = `${nav(r.sourceEnd) ? '<' : ''}--${nav(r.targetEnd) ? '>' : ''}`;
			return `${s}${mult(r.sourceEnd)} ${arrow} ${multAfter(r.targetEnd)}${t}${label}`;
		}
	}
}

/**
 * The diagram as text. `kept` lines (comments and what Aster does not model, from the last parse)
 * go back in before `@enduml`, so nothing typed is lost.
 */
export function printDiagram(project: Project, diagram: Diagram, kept: string[] = []): string {
	const el = (id: Id) => project.elements.get(id);
	const on = diagram.elementIds;
	const classes = on.map(el).filter((e): e is Classifier => e?.kind === 'classifier');
	const shown = new Set(classes.map((c) => c.id));
	const name = (id: Id) => {
		const e = el(id);
		return pumlName(e?.kind === 'classifier' ? e.name : id);
	};
	const rels = on
		.map(el)
		.filter(
			(e): e is Relationship =>
				e?.kind === 'relationship' && shown.has(e.sourceId) && shown.has(e.targetId)
		);
	const notes = on.map(el).filter((e) => e?.kind === 'note');
	const out = ['@startuml', ...classes.flatMap(block)];
	if (rels.length || notes.length) out.push('');
	out.push(...rels.map((r) => relationship(r, name)));
	notes.forEach((nt, i) => {
		if (nt?.kind !== 'note') return;
		const alias = `N${i + 1}`;
		if (nt.text.includes('\n')) out.push(`note as ${alias}`, ...nt.text.split('\n'), 'end note');
		else out.push(`note "${nt.text.replace(/"/g, '\\"')}" as ${alias}`);
		for (const target of nt.linkedIds)
			if (shown.has(target)) out.push(`${alias} .. ${name(target)}`);
	});
	out.push(...kept, '@enduml', '');
	return out.join('\n');
}
