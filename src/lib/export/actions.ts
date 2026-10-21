/** Export of the open diagram with the sheet's current options (board 06), and ⌘⇧C. */
import { canvasRects } from '#lib/canvas/focus.ts';
import { t } from '#lib/i18n/index.ts';
import { announce } from '#lib/stores/live.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { files, fileText } from '#lib/persist/files.svelte.ts';
import { copyPng, download, embeddedFontCss, svgBlob, svgToPng } from './image.ts';
import { diagramToSvg, slug } from './svg.ts';

export interface ExportOptions {
	format: 'png' | 'svg' | 'mdj' | 'aster';
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

export const isImage = (f: ExportOptions['format']) => f === 'png' || f === 'svg';

/** Images are named after the diagram, files after the project (docs/file-format.md). */
export function fileName(o: ExportOptions) {
	if (!isImage(o.format)) return `${slug(projectStore.project.name)}.${o.format}`;
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
	// The file-format rows are plain downloads through the serializers; they never change files.current.
	if (!isImage(o.format)) return new Blob([fileText(o.format)], { type: 'application/json' });
	const r = await render(o);
	return o.format === 'svg' ? svgBlob(r.svg) : svgToPng(r.svg, r.width, r.height, o.scale);
}

export async function downloadExport(o: ExportOptions) {
	download(await exportBlob(o), fileName(o));
}

/**
 * The ⌘S notice's and the browser-only banner's one click (owner's ruling, 2026-10-21): the
 * export's .mdj, which StarUML opens; like every export it leaves the file link alone. The
 * banner has done its job once a copy exists.
 */
export async function downloadMdj() {
	await downloadExport({ ...DEFAULT_EXPORT, format: 'mdj' });
	files.bannerDismissed = true;
}

/**
 * ⌘⇧C (StarUML's key): the diagram to the clipboard as a 2× PNG on white. The result is
 * announced; the sheet also shows it inline, so no native alert.
 */
export async function copyDiagramAsPng(o: ExportOptions = DEFAULT_EXPORT): Promise<boolean> {
	try {
		await copyPng(await exportBlob({ ...o, format: 'png' }));
		announce(t('export.copied'));
		return true;
	} catch {
		announce(t('export.copyFailed'));
		return false;
	}
}
