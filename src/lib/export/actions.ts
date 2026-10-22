/** Export of the open diagram with the sheet's current options (board 06), and ⌘⇧C. */
import { canvasRects } from '#lib/canvas/focus.ts';
import { t } from '#lib/i18n/index.ts';
import { printDiagram } from '#lib/puml/print.ts';
import { announce } from '#lib/stores/live.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { baseName, files, fileText } from '#lib/persist/files.svelte.ts';
import { copyPng, download, embeddedFontCss, paperFonts, svgBlob, svgToPng } from './image.ts';
import { diagramToMermaid } from './mermaid.ts';
import type { Orientation, PageSize } from './pdf.ts';
import { diagramToSvg, slug } from './svg.ts';

/**
 * M3.4 prompt: one sheet with tabs rather than separate dialogs. Image, PDF and Text cover this
 * diagram; Project the whole project as a file.
 */
export type ExportTab = 'image' | 'pdf' | 'text' | 'project';
export type ExportFormat = 'png' | 'svg' | 'pdf' | 'mermaid' | 'puml' | 'mdj' | 'aster';
export const TAB_FORMATS: Record<ExportTab, ExportFormat[]> = {
	image: ['png', 'svg'],
	pdf: ['pdf'],
	text: ['mermaid', 'puml'],
	project: ['mdj', 'aster']
};
export const tabOf = (f: ExportFormat) =>
	(Object.keys(TAB_FORMATS) as ExportTab[]).find((k) => TAB_FORMATS[k].includes(f))!;

export interface ExportOptions {
	format: ExportFormat;
	scale: 1 | 2;
	background: 'white' | 'transparent';
	selectionOnly: boolean;
	page: PageSize;
	orientation: Orientation;
}
export const DEFAULT_EXPORT: ExportOptions = {
	format: 'png',
	scale: 2,
	background: 'white',
	selectionOnly: false,
	page: 'a4',
	orientation: 'auto'
};

export const isImage = (f: ExportFormat) => tabOf(f) === 'image';
export const isText = (f: ExportFormat) => tabOf(f) === 'text';
const EXTENSION: Partial<Record<ExportFormat, string>> = { mermaid: 'mmd' };

/** Images and text are named after the diagram, files as saving names them (baseName: the file, the project, the diagram). */
export function fileName(o: ExportOptions) {
	if (tabOf(o.format) === 'project') return `${baseName()}.${o.format}`;
	const scale = o.format === 'png' && o.scale === 2 ? '@2x' : '';
	return `${slug(projectStore.diagram.name)}${scale}.${EXTENSION[o.format] ?? o.format}`;
}

/** The diagram as SVG for `o`, with the paper font embedded (the PDF registers it instead). */
export async function render(o: ExportOptions) {
	const only = o.selectionOnly && selection.size ? new Set(selection.list) : null;
	const pdf = o.format === 'pdf';
	return diagramToSvg(projectStore.project, projectStore.diagram, canvasRects.get(), {
		only,
		background: pdf ? 'white' : o.background,
		fontCss: pdf ? undefined : await embeddedFontCss()
	});
}

/** The PDF tab's file; takumi-pdf and its fonts load on the first one. */
async function pdfBlob(o: ExportOptions): Promise<Blob> {
	const [{ svgToPdf }, svg, fonts] = await Promise.all([
		import('./pdf.ts'),
		render(o),
		paperFonts()
	]);
	const d = projectStore.diagram;
	const counts = { nodes: 0, edges: 0 };
	for (const id of d.elementIds) {
		const k = projectStore.project.elements.get(id)?.kind;
		if (k === 'classifier') counts.nodes++;
		else if (k === 'relationship') counts.edges++;
	}
	const bytes = await svgToPdf(
		svg,
		{
			page: o.page,
			orientation: o.orientation,
			title: d.name,
			alt: t('export.pdfAlt', { name: d.name, ...counts }),
			// ponytail: English is the one shipped locale; take it from i18n when a second ships
			lang: 'en'
		},
		fonts
	);
	return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/** The Text tab's formats: the whole diagram as Mermaid or PlantUML. */
export const exportText = (f: ExportFormat) =>
	f === 'mermaid'
		? diagramToMermaid(projectStore.project, projectStore.diagram)
		: printDiagram(projectStore.project, projectStore.diagram);

export async function exportBlob(o: ExportOptions): Promise<Blob> {
	// The file-format rows are plain downloads through the serializers; they never change files.current.
	if (tabOf(o.format) === 'project')
		return new Blob([fileText(o.format as 'mdj' | 'aster')], { type: 'application/json' });
	if (isText(o.format)) return new Blob([exportText(o.format)], { type: 'text/plain' });
	if (o.format === 'pdf') return pdfBlob(o);
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

/** The Text tab's Copy: the text itself, for a README or an issue. */
export async function copyExportText(f: ExportFormat): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(exportText(f));
		announce(t('export.copied'));
		return true;
	} catch {
		announce(t('export.copyTextFailed'));
		return false;
	}
}
