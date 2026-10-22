/** features.md M3, "Fill and line colour": per-element colours from the inspector. */
import { describe, expect, it } from 'vitest';
import { Stack, setColour } from '#lib/commands/index.ts';
import { contrast, fillOf, lineOf } from '#lib/canvas/paint.ts';
import { diagramToSvg } from '#lib/export/svg.ts';
import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
import { getDiagram } from '#lib/model/project.ts';
import type { EdgeLayout, NodeLayout } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

describe('which colours count', () => {
	it("StarUML's defaults, written on every view, are no colour", () => {
		expect(fillOf({ fill: '#ffffff' })).toBeUndefined();
		expect(fillOf({ fill: '#FFFFFF' })).toBeUndefined();
		expect(lineOf({ line: '#000000' })).toBeUndefined();
		expect(fillOf({})).toBeUndefined();
	});
	it('real colours come through in lower case; anything not #rrggbb is ignored', () => {
		expect(fillOf({ fill: '#FFFFD8' })).toBe('#ffffd8');
		expect(lineOf({ line: '#91ffec' })).toBe('#91ffec');
		expect(fillOf({ fill: 'red' })).toBeUndefined();
		expect(lineOf({ line: '#abc' })).toBeUndefined();
	});
	it('contrast is the WCAG ratio', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrast('#1b1b1b', '#ffffd8')).toBeGreaterThan(4.5);
		expect(contrast('#1b1b1b', '#1e3a8a')).toBeLessThan(4.5);
	});
});

describe('setColour', () => {
	it('sets, resets and undoes a fill and a line, one step each', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const before = structural(project);
		const node = () => getDiagram(project, 'd1').layout.get('Account') as NodeLayout;
		expect(
			stack.run(
				setColour(project, { diagramId: 'd1', id: 'Account', key: 'fill', colour: '#ffffd8' })
			)
		).toBe('change the fill colour of Account');
		stack.run(
			setColour(project, { diagramId: 'd1', id: 'Account', key: 'line', colour: '#1e3a8a' })
		);
		expect([node().fill, node().line]).toEqual(['#ffffd8', '#1e3a8a']);
		expect(
			stack.run(setColour(project, { diagramId: 'd1', id: 'Account', key: 'fill', colour: null }))
		).toBe('reset the fill colour of Account');
		expect('fill' in node()).toBe(false);
		stack.undo();
		expect(node().fill).toBe('#ffffd8');
		stack.undo();
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('gives an edge a line colour but never a fill', () => {
		const project = notationProject();
		const stack = new Stack(() => project);
		stack.run(
			setColour(project, { diagramId: 'd1', id: 'borrows', key: 'line', colour: '#b91c1c' })
		);
		expect((getDiagram(project, 'd1').layout.get('borrows') as EdgeLayout).line).toBe('#b91c1c');
		expect(() =>
			setColour(project, { diagramId: 'd1', id: 'borrows', key: 'fill', colour: '#ffffff' }).apply(
				project
			)
		).toThrow();
	});
});

describe('colours in the exported SVG', () => {
	const project = notationProject();
	const diagram = project.diagrams[0];
	const rects = new Map(
		[...diagram.layout].flatMap(([id, l]) =>
			l.kind === 'node' ? [[id, { x: l.x, y: l.y, w: Math.max(160, l.w), h: 80 }] as const] : []
		)
	);

	it('paints fills and lines, and gives a coloured edge markers in its colour', () => {
		const loan = diagram.layout.get('Loan') as NodeLayout;
		loan.fill = '#ffffd8';
		loan.line = '#1e3a8a';
		(diagram.layout.get('real') as EdgeLayout).line = '#b91c1c';
		const { svg } = diagramToSvg(project, diagram, rects, { background: 'white' });
		expect(svg).toMatch(/data-name="Loan"><rect [^>]*fill="#ffffd8" stroke="#1e3a8a"/);
		expect(svg).toContain('marker-end="url(#aster-m-triangle-b91c1c)"');
		expect(svg).toMatch(/<marker id="aster-m-triangle-b91c1c"[^>]*><path [^>]*stroke="#b91c1c"/);
		// Uncoloured edges keep the shared ink markers; no marker set for colours nobody uses.
		expect(svg).toContain('marker-end="url(#aster-m-triangle)"');
		expect(svg).not.toContain('aster-m-arrow-1e3a8a');
	});
});
