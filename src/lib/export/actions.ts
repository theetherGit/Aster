/** Export of the open diagram with the sheet's current options (board 06), and ⌘⇧C. */
import { canvasRects } from '#lib/canvas/focus.ts';
import { t } from '#lib/i18n/index.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { copyPng, download, embeddedFontCss, svgBlob, svgToPng } from './image.ts';
import { diagramToSvg, slug } from './svg.ts';

export interface ExportOptions {
	format: 'png' | 'svg';
	scale: 1 | 2;
	background: 'white' | 'transparent';
	selectionOnly: boolean;
}
export const DEFAULT_EXPORT: ExportOptions = {
	format: 'png',
	scale: 2,
	background: 'white',
	selectionOnly: false
};

export function fileName(o: ExportOptions) {
	return `${slug(projectStore.diagram.name)}${o.format === 'png' && o.scale === 2 ? '@2x' : ''}.${o.format}`;
}

/** The diagram as SVG for `o`, with the paper font embedded. */
export async function render(o: ExportOptions) {
	const only = o.selectionOnly && selection.size ? new Set(selection.list) : null;
	const fontCss = await embeddedFontCss();
	return diagramToSvg(projectStore.project, projectStore.diagram, canvasRects.get(), {
		only,
		background: o.background,
		fontCss
	});
}

export async function exportBlob(o: ExportOptions): Promise<Blob> {
	const r = await render(o);
	return o.format === 'svg' ? svgBlob(r.svg) : svgToPng(r.svg, r.width, r.height, o.scale);
}

export async function downloadExport(o: ExportOptions) {
	download(await exportBlob(o), fileName(o));
}

/** ⌘⇧C (StarUML's key): the diagram to the clipboard as a 2× PNG on white. */
export async function copyDiagramAsPng(o: ExportOptions = DEFAULT_EXPORT): Promise<boolean> {
	try {
		await copyPng(await exportBlob({ ...o, format: 'png' }));
		return true;
	} catch {
		alert(t('export.copyFailed'));
		return false;
	}
}
