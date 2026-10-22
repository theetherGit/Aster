/**
 * features.md M3, "PDF export": a vector PDF of the diagram, through takumi-pdf (owner's pick,
 * 2026-10-22), loaded on the first PDF only (its WASM is 1.85 MB gzipped). The page holds the SVG
 * export as an image, so a PDF draws exactly what SVG and PNG draw; takumi turns it into paths,
 * the paper font's text included (as outlines: the tagged figure's alt text carries the words).
 * One page, like StarUML's: the diagram fits inside the margins and is never enlarged.
 */
import type { SvgResult } from './svg.ts';

export type PageSize = 'a4' | 'a3' | 'letter';
export type Orientation = 'auto' | 'landscape' | 'portrait';
export interface PdfOptions {
	page: PageSize;
	orientation: Orientation;
	title: string;
	/** What the figure says to a screen reader. */
	alt: string;
	lang: string;
}
/** The bundled paper font's faces (export/image.ts fetches them in the browser). */
export interface PaperFont {
	style: 'normal' | 'italic';
	data: Uint8Array;
}

/** Portrait page sizes in CSS px at 96 dpi, as takumi measures them. */
const PAGE: Record<PageSize, [number, number]> = {
	a4: [793.7, 1122.5],
	a3: [1122.5, 1587.4],
	letter: [816, 1056]
};
/** 36 CSS px: a ⅜-inch margin, inside what printers leave blank. */
const MARGIN = 36;

/** The diagram's size on the page, and which way the page turns. */
export function fit(
	size: { width: number; height: number },
	o: Pick<PdfOptions, 'page' | 'orientation'>
) {
	const landscape =
		o.orientation === 'auto' ? size.width > size.height : o.orientation === 'landscape';
	const [w, h] = landscape ? [PAGE[o.page][1], PAGE[o.page][0]] : PAGE[o.page];
	const scale = Math.min(1, (w - 2 * MARGIN) / size.width, (h - 2 * MARGIN) / size.height);
	return { landscape, scale, width: size.width * scale, height: size.height * scale };
}

const attr = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function svgToPdf(
	svg: SvgResult,
	o: PdfOptions,
	fonts: PaperFont[]
): Promise<Uint8Array> {
	const { render } = await import('takumi-pdf');
	const f = fit(svg, o);
	return render(
		`<div style="display:flex;justify-content:center"><img src="diagram.svg" width="${f.width}" height="${f.height}" alt="${attr(o.alt)}"></div>`,
		{
			size: o.page,
			landscape: f.landscape,
			margin: MARGIN,
			// ponytail: fit() keeps it to one page; this drops a rounding spill-over just in case
			pageRanges: [1],
			fonts: fonts.map((x) => ({ name: 'Source Sans 3', style: x.style, data: x.data })),
			images: [{ src: 'diagram.svg', data: new TextEncoder().encode(svg.svg) }],
			metadata: { title: o.title, creator: 'Aster' },
			lang: o.lang,
			uncoveredText: 'blank'
		}
	);
}
