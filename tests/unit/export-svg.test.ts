import { describe, expect, it } from 'vitest';
import { diagramToSvg, slug } from '#lib/export/svg.ts';
import { notationProject } from '#lib/model/fixtures.ts';
import { createClassifier, createDiagram, createProject } from '#lib/model/project.ts';

describe('diagram → SVG', () => {
	const project = notationProject();
	const diagram = project.diagrams[0];
	const rects = new Map(
		[...diagram.layout].flatMap(([id, l]) =>
			l.kind === 'node' ? [[id, { x: l.x, y: l.y, w: Math.max(160, l.w), h: 80 }] as const] : []
		)
	);

	it('draws every node and edge, no grid, and embeds the font css it is given', () => {
		const { svg, width, height } = diagramToSvg(project, diagram, rects, {
			background: 'white',
			fontCss: '@font-face{font-family:"Source Sans 3";src:url(data:x)}'
		});
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect((svg.match(/<g class="node"/g) ?? []).length).toBe(8);
		expect((svg.match(/<g class="edge"/g) ?? []).length).toBe(8);
		expect(svg).toContain('<style>@font-face');
		expect(svg).not.toMatch(/pattern|grid/i);
		expect(svg).toContain('«interface»');
		expect(svg).toContain('«enumeration»');
		expect(svg).toContain('marker-end="url(#aster-m-triangle)"');
		expect(svg).toContain('stroke-dasharray="6 4"');
		expect(width).toBeGreaterThan(600);
		expect(height).toBeGreaterThan(400);
	});

	it('transparent background has no paper rect; selection-only keeps only the chosen nodes and their edges', () => {
		const white = diagramToSvg(project, diagram, rects, { background: 'white' });
		const clear = diagramToSvg(project, diagram, rects, { background: 'transparent' });
		expect(white.svg).toContain(`fill="#ffffff"/><g`);
		expect(clear.svg).not.toContain(`height="${clear.height}" fill="#ffffff"`);
		const only = diagramToSvg(project, diagram, rects, {
			background: 'white',
			only: new Set(['Loan', 'Book'])
		});
		expect((only.svg.match(/<g class="node"/g) ?? []).length).toBe(2);
		expect((only.svg.match(/<g class="edge"/g) ?? []).length).toBe(1);
		expect(only.svg).toContain('data-rel-id="borrows"');
	});

	it('escapes text and makes safe file stems', () => {
		const p = notationProject();
		const c = p.elements.get('Loan');
		if (c?.kind === 'classifier') c.name = 'A<B> & "C"';
		const { svg } = diagramToSvg(p, p.diagrams[0], rects, { background: 'white' });
		expect(svg).toContain('A&lt;B&gt; &amp; &quot;C&quot;');
		expect(slug('Class diagram')).toBe('class-diagram');
		expect(slug('  ')).toBe('diagram');
		expect(slug('Überblick: Domain / v2')).toBe('uberblick-domain-v2');
	});

	it('crops to the drawing, wherever on the paper it sits (lab audit, 2026-10-22)', () => {
		const p = createProject({ id: 'p' });
		const d = createDiagram({ id: 'd' });
		p.diagrams.push(d);
		p.elements.set('A', createClassifier({ id: 'A', name: 'A' }));
		d.elementIds.push('A');
		d.layout.set('A', { kind: 'node', x: 600, y: 400, w: 160, h: 60 });
		const r = diagramToSvg(p, d, new Map(), { background: 'white' });
		expect([r.width, r.height]).toEqual([200, 100]);
		expect(r.svg).toContain('viewBox="580 380 200 100"');
		// An empty diagram still makes a small, valid file.
		const empty = diagramToSvg(p, createDiagram({ id: 'e' }), new Map(), { background: 'white' });
		expect([empty.width, empty.height]).toEqual([40, 40]);
	});
});
