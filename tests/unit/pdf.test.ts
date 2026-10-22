/**
 * features.md M3, "PDF export": a vector PDF of the whole diagram or the selection, with page size
 * and orientation (M3.4 prompt), through takumi-pdf (owner's pick, 2026-10-22).
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fit, svgToPdf, type PaperFont } from '#lib/export/pdf.ts';
import { contentRects, diagramToSvg } from '#lib/export/svg.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { notationProject } from '#lib/model/fixtures.ts';

const fonts: PaperFont[] = (['normal', 'italic'] as const).map((style) => ({
	style,
	data: readFileSync(`src/lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-${style}.woff2`)
}));
/** The PDF as text, its compressed streams opened, for looking things up. */
function text(pdf: Uint8Array) {
	const b = Buffer.from(pdf);
	const s = b.toString('latin1');
	let out = s;
	for (const m of s.matchAll(/stream\r?\n/g)) {
		const start = m.index + m[0].length;
		try {
			out += inflateSync(b.subarray(start, s.indexOf('endstream', start))).toString('latin1');
		} catch {
			// not a Flate stream
		}
	}
	return out;
}
const pages = (s: string) => (s.match(/\/Type\s*\/Page\b/g) ?? []).length;

describe('fitting the diagram to the page', () => {
	it('turns the page to the diagram when asked to choose, and never enlarges it', () => {
		expect(fit({ width: 1200, height: 600 }, { page: 'a4', orientation: 'auto' })).toMatchObject({
			landscape: true
		});
		expect(fit({ width: 400, height: 900 }, { page: 'a4', orientation: 'auto' })).toMatchObject({
			landscape: false
		});
		const small = fit({ width: 300, height: 200 }, { page: 'a3', orientation: 'auto' });
		expect([small.width, small.height, small.scale]).toEqual([300, 200, 1]);
	});
	it('shrinks a large diagram to the margins of the page and orientation chosen', () => {
		const f = fit({ width: 3000, height: 1000 }, { page: 'letter', orientation: 'portrait' });
		expect(f.landscape).toBe(false);
		expect(f.width).toBeCloseTo(816 - 2 * 36, 0);
		expect(f.scale).toBeLessThan(0.3);
	});
});

describe('the PDF', () => {
	it('is one vector A4 page with a title, a language and the diagram tagged with its text', async () => {
		const p = notationProject();
		const d = p.diagrams[0];
		const r = diagramToSvg(p, d, contentRects(p, d), { background: 'white' });
		const pdf = await svgToPdf(
			r,
			{
				page: 'a4',
				orientation: 'auto',
				title: 'Library',
				alt: 'UML class diagram Library',
				lang: 'en'
			},
			fonts
		);
		const s = text(pdf);
		expect(s.startsWith('%PDF-')).toBe(true);
		expect(pages(s)).toBe(1);
		expect(s).toMatch(/\/MediaBox\s*\[0 0 841\.8\d* 595\.2\d*\]/);
		expect(s).not.toMatch(/\/Subtype\s*\/Image/);
		expect(s).toContain('/Title(Library)');
		expect(s).toContain('/Alt(UML class diagram Library)');
	});

	it('still renders names in scripts the bundled font does not cover', async () => {
		const p = notationProject();
		const loan = p.elements.get('Loan');
		if (loan?.kind === 'classifier') loan.name = '借阅 Loan';
		const d = p.diagrams[0];
		const r = diagramToSvg(p, d, contentRects(p, d), { background: 'white' });
		const pdf = await svgToPdf(
			r,
			{ page: 'a4', orientation: 'auto', title: '图书馆', alt: '图书馆', lang: 'zh' },
			fonts
		);
		expect(pages(text(pdf))).toBe(1);
	});

	it('keeps a large real diagram on one page', async () => {
		const { project } = parseMdjText(readFileSync('fixtures/mdj/public-hydgl.mdj', 'utf8'));
		const d = project.diagrams.find((x) => x.elementIds.length > 10)!;
		const r = diagramToSvg(project, d, contentRects(project, d), { background: 'white' });
		const pdf = await svgToPdf(
			r,
			{ page: 'a4', orientation: 'portrait', title: d.name, alt: d.name, lang: 'en' },
			fonts
		);
		expect(pages(text(pdf))).toBe(1);
	});
});
