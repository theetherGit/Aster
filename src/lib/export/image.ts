/** Browser side of export: the paper font's bytes and data URIs, SVG → PNG, download and clipboard. */
import italic from '#lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-italic.woff2?url';
import normal from '#lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-normal.woff2?url';
import type { PaperFont } from './pdf.ts';

let faces: Promise<PaperFont[]> | undefined;
let fontCss: Promise<string> | undefined;

/** The paper font's Latin faces as bytes, fetched once: the PDF registers them, SVG inlines them. */
export function paperFonts(): Promise<PaperFont[]> {
	faces ??= Promise.all(
		(
			[
				[normal, 'normal'],
				[italic, 'italic']
			] as const
		).map(async ([url, style]) => ({
			style,
			data: new Uint8Array(await (await fetch(url)).arrayBuffer())
		}))
	);
	return faces;
}

/** `@font-face` rules with the Latin faces inlined. */
export function embeddedFontCss(): Promise<string> {
	fontCss ??= paperFonts().then((fonts) =>
		fonts
			.map(({ style, data }) => {
				let bin = '';
				for (let i = 0; i < data.length; i += 0x8000)
					bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
				return `@font-face{font-family:'Source Sans 3';font-style:${style};font-weight:200 900;src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2')}`;
			})
			.join('')
	);
	return fontCss;
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

/** Rasterise SVG text at `scale` device pixels per unit. */
export function svgToPng(svg: string, width: number, height: number, scale: 1 | 2): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(svgBlob(svg));
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(width * scale);
			canvas.height = Math.ceil(height * scale);
			const ctx = canvas.getContext('2d')!;
			ctx.scale(scale, scale);
			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))),
				'image/png'
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('SVG failed to render'));
		};
		img.src = url;
	});
}

export function download(blob: Blob, name: string) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.hidden = true;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copyPng(blob: Blob) {
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve) => {
		const r = new FileReader();
		r.onload = () => resolve(r.result as string);
		r.readAsDataURL(blob);
	});
