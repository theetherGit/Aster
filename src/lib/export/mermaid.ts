/**
 * features.md M3, "Mermaid export": a diagram as Mermaid `classDiagram` text, one way (import is
 * v0.2, parity.md). Written to what Mermaid 11's own parser takes, checked by rendering:
 * - members are lines in the class body; a `{…}` there would close it, so braces go as `#123;` /
 *   `#125;`, and `<` / `>` in types become Mermaid's generic `~`;
 * - an operation's type follows its `)` after a space (`name() Type`); `$` marks static, `*`
 *   abstract, both at the very end;
 * - a name Mermaid cannot take as an id gets an id and a `["label"]`;
 * - each end's role goes with its multiplicity in the end's quoted text; the ownership dot has no
 *   Mermaid form and is left out.
 * The model is printed in full: the diagram's display toggles are for drawing, not for this text.
 */
import { headerLabel } from '#lib/canvas/inline.ts';
import { labelsFor, markersFor } from '#lib/canvas/edges/notation.ts';
import { renderAttribute, renderParameter, SYM_OF } from '#lib/mdj/expression.ts';
import type { Classifier, Diagram, Id, Operation, Project } from '#lib/model/types.ts';
import { DEFAULT_DISPLAY_FLAGS } from '#lib/model/types.ts';

/** Text inside a class body or a quoted string, made safe for Mermaid. */
const body = (s: string) =>
	s.replace(/\{/g, '#123;').replace(/\}/g, '#125;').replace(/</g, '~').replace(/>/g, '~');
const quoted = (s: string) => s.replace(/"/g, '#quot;');

const SIDE = {
	triangle: ['<|', '|>'],
	'diamond-filled': ['*', '*'],
	'diamond-hollow': ['o', 'o'],
	arrow: ['<', '>']
} as const;

function attributeLine(a: Classifier['attributes'][number]) {
	// The canonical line has a space after the symbol; Mermaid reads the symbol off the front.
	const text = renderAttribute(a, { guillemets: true, keywords: false }).replace(
		/^([+\-#~]) /,
		'$1'
	);
	return body(text) + (a.isStatic ? '$' : '');
}

function operationLine(op: Operation) {
	const stereo = op.stereotype ? `«${op.stereotype}» ` : '';
	const props = op.isQuery ? ' {query}' : '';
	const text = `${stereo}${SYM_OF[op.visibility]}${op.name}(${op.parameters.map(renderParameter).join(', ')})${op.returnType ? ` ${op.returnType}` : ''}${props}`;
	return body(text) + (op.isStatic ? '$' : op.isAbstract ? '*' : '');
}

/** The diagram as Mermaid text, classes in diagram order. */
export function diagramToMermaid(project: Project, diagram: Diagram): string {
	const shown = (id: Id) => diagram.layout.get(id)?.kind === 'node';
	const classes = diagram.elementIds.flatMap((id) => {
		const el = project.elements.get(id);
		return el?.kind === 'classifier' && shown(id) ? [el] : [];
	});

	// Ids: the name when Mermaid takes it, else the name with every other character as `_`.
	const ids = new Map<Id, string>();
	const taken = new Set<string>();
	for (const c of classes) {
		let id = /^[A-Za-z_]\w*$/.test(c.name)
			? c.name
			: c.name.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'Class';
		if (/^\d/.test(id)) id = `C_${id}`;
		const base = id;
		for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
		taken.add(id);
		ids.set(c.id, id);
	}

	const title = /^[\w .-]+$/.test(diagram.name) ? diagram.name : JSON.stringify(diagram.name);
	const out = ['---', `title: ${title}`, '---', 'classDiagram'];
	for (const c of classes) {
		const id = ids.get(c.id)!;
		if (id !== c.name) out.push(`  class ${id}["${quoted(c.name)}"]`);
		const header = headerLabel(c) ?? (c.isAbstract ? 'abstract' : undefined);
		const lines = [
			...(header ? [`<<${body(header)}>>`] : []),
			...c.literals.map((l) => body(l.name)),
			...c.attributes.map(attributeLine),
			...c.operations.map(operationLine)
		];
		if (!lines.length) {
			if (id === c.name) out.push(`  class ${id}`);
			continue;
		}
		out.push(`  class ${id} {`, ...lines.map((l) => `    ${l}`), '  }');
	}

	for (const id of diagram.elementIds) {
		const r = project.elements.get(id);
		if (r?.kind !== 'relationship' || diagram.layout.get(id)?.kind !== 'edge') continue;
		const src = ids.get(r.sourceId);
		const tgt = ids.get(r.targetId);
		if (!src || !tgt) continue;
		const m = markersFor(r);
		const line = m.dashed ? '..' : '--';
		const arrow = `${m.start ? SIDE[m.start][0] : ''}${line}${m.end ? SIDE[m.end][1] : ''}`;
		const labels = labelsFor(r, { ...DEFAULT_DISPLAY_FLAGS, showProperty: true });
		const end = (at: 'source' | 'target') => {
			const text = ['Multiplicity', 'Role', 'Property']
				.flatMap((k) => labels.find((l) => l.key === `${at}${k}`)?.lines ?? [])
				.join(' ');
			return text ? `"${quoted(body(text))}" ` : '';
		};
		const mid = labels.find((l) => l.key === 'name')?.lines.join(' ');
		out.push(
			`  ${src} ${end('source')}${arrow} ${end('target')}${tgt}${mid ? ` : ${body(mid)}` : ''}`
		);
	}

	for (const id of diagram.elementIds) {
		const n = project.elements.get(id);
		if (n?.kind !== 'note' || !shown(id)) continue;
		const text = quoted(n.text).replace(/\r?\n/g, '<br>');
		const on = n.linkedIds.map((l) => ids.get(l)).find(Boolean);
		out.push(on ? `  note for ${on} "${text}"` : `  note "${text}"`);
	}
	return out.join('\n') + '\n';
}
