/**
 * Files (docs/file-format.md): open `.mdj`, `.aster` or `.aster.json` (⌘O picker with File System
 * Access when available, an <input type=file> otherwise; drops on the window), save back in the
 * format the file was opened as (⌘S to the handle, else a download), save a copy (⌘⇧S), the
 * unsaved-changes guard (board 20) and the three save states (ui.md).
 */
import {
	AsterError,
	hashBytes,
	parseAster,
	serializeAsterText,
	type AsterOrigin
} from '#lib/aster/index.ts';
import { canvasFocus } from '#lib/canvas/focus.ts';
import { slug } from '#lib/export/svg.ts';
import { t } from '#lib/i18n/index.ts';
import { MdjError, type ParseReport } from '#lib/mdj/parse.ts';
import { serializeMdjText } from '#lib/mdj/serialize.ts';
import { parseInWorker } from '#lib/mdj/worker.ts';
import { createDiagram, createProject } from '#lib/model/project.ts';
import { batch, importFragment, Stack } from '#lib/commands/index.ts';
import { readFragment } from '#lib/mdj/fragment.ts';
import { parsePuml } from '#lib/puml/parse.ts';
import { printDiagram } from '#lib/puml/print.ts';
import { planSync } from '#lib/puml/sync.ts';
import type { Project } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import { formatOf, sniffFormat, type FileFormat } from './format.ts';
import { findBySourceHash, flush, mintSlug, openSaved, persist } from './autosave.svelte.ts';

export { formatOf, type FileFormat };

export interface OpenedFile {
	name: string;
	data: ArrayBuffer;
	handle?: FileSystemFileHandle;
	/** The file's time on disk when read; watched while it stays open (owner's ruling #22). */
	lastModified?: number;
}

export type ImportNotice =
	| { kind: 'opening'; file: string }
	| { kind: 'opened'; file: string; report: ParseReport }
	| { kind: 'restored'; file: string }
	| { kind: 'failed'; file: string; message: string; invalid: boolean }
	| { kind: 'changed'; file: string; lastModified: number }
	| { kind: 'imported'; file: string };

/** Board 20: what the user was about to do when the prompt opened. */
export interface PendingAction {
	/** The file about to open, or null for a new project. */
	nextName: string | null;
	run: () => Promise<void>;
}

class Files {
	notice: ImportNotice | null = $state(null);
	/** The open file's time on disk as Aster last read or wrote it. */
	knownModified: number | null = null;
	dragging = $state(false);
	/** The file this project lives in, when it has one, and the format ⌘S writes. */
	current: { name: string; format: FileFormat; handle?: FileSystemFileHandle } | null =
		$state(null);
	/** For an mdj-born project: the hash of the .mdj bytes last read or written. */
	origin: AsterOrigin | null = $state(null);
	/** projectStore.version when the file was last written. */
	savedVersion = $state(0);
	lastSavedAt: number | null = $state(null);
	/** ui.md: the "lives only in this browser" banner shows once per project. */
	bannerDismissed = $state(false);
	pending: PendingAction | null = $state(null);
	saving = $state(false);

	/** Edits since the last file save. */
	get dirty() {
		return projectStore.version !== this.savedVersion;
	}
	/**
	 * ui.md's three states, plus `new`: a project that lives only in the browser and has no edits yet
	 * (the sample on first visit, an untouched ⌘N). Nothing can be lost, so no dot and no banner.
	 */
	get state(): 'saved' | 'unsaved' | 'never' | 'new' {
		if (!this.current) return this.dirty ? 'never' : 'new';
		return this.dirty ? 'unsaved' : 'saved';
	}
}

export const files = new Files();

const TYPES = [
	{ description: 'Aster project', accept: { 'application/json': ['.aster', '.aster.json'] } },
	{ description: 'StarUML model', accept: { 'application/json': ['.mdj'] } }
];
/**
 * The open dialog starts filtered on its first type, so one entry covers both formats; the two
 * single-format entries follow for anyone who wants to narrow the list.
 */
const OPEN_TYPES: { description: string; accept: Record<string, string[]> }[] = [
	{
		description: 'Aster or StarUML project, or PlantUML',
		accept: { 'application/json': ['.aster', '.aster.json', '.mdj'], 'text/plain': ['.puml'] }
	},
	...TYPES,
	{ description: 'PlantUML class diagram', accept: { 'text/plain': ['.puml'] } }
];
const PUML_TYPES = [{ description: 'PlantUML class diagram', accept: { 'text/plain': ['.puml'] } }];

/** ⌘O: ask for a file. Resolves to null when the user cancels. */
export async function pickFile(
	types = OPEN_TYPES,
	accept = '.mdj,.aster,.aster.json,.puml,application/json'
): Promise<OpenedFile | null> {
	if (window.showOpenFilePicker) {
		try {
			const [handle] = await window.showOpenFilePicker({ types, multiple: false });
			const file = await handle.getFile();
			return {
				name: file.name,
				data: await file.arrayBuffer(),
				handle,
				lastModified: file.lastModified
			};
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return null;
			throw e;
		}
	}
	return new Promise((resolve) => {
		// Attached while the chooser is open: a detached input has nothing keeping it alive.
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.hidden = true;
		document.body.append(input);
		const done = (file: OpenedFile | null) => {
			input.remove();
			resolve(file);
		};
		input.addEventListener(
			'change',
			async () => {
				const f = input.files?.[0];
				done(f ? { name: f.name, data: await f.arrayBuffer() } : null);
			},
			{ once: true }
		);
		input.addEventListener('cancel', () => done(null), { once: true });
		input.click();
	});
}

function startFresh() {
	ui.link = null;
	ui.picker = null;
	ui.sampleStrip = false;
	selection.editing = null;
	selection.clear();
	persist.slug = null;
}

/** A bundled project (the sample, the demo, the notation fixture) under its reserved route, unnamed until edited. */
export function loadFixture(project: Project, route: 'sample' | 'demo' | 'notation') {
	startFresh();
	projectStore.load(project);
	files.current = null;
	files.origin = null;
	files.savedVersion = projectStore.version;
	files.lastSavedAt = null;
	files.bannerDismissed = false;
	persist.route = route;
}

/** Open a file: `.aster` validates and loads; `.mdj` restores its autosave on a hash match, else parses. */
export async function openFile(f: OpenedFile) {
	if (isPuml(f)) return openPuml(f);
	files.notice = { kind: 'opening', file: f.name };
	// By content first: a StarUML file renamed `.aster` still opens as StarUML (and the reverse).
	const format = sniffFormat(f.name, new TextDecoder('utf-8').decode(f.data.slice(0, 1024)));
	try {
		if (format === 'aster') {
			const { project, origin } = parseAster(new TextDecoder('utf-8').decode(f.data));
			startFresh();
			projectStore.load(project);
			files.origin = origin ?? null;
			files.notice = null;
		} else {
			// The opened file wins: an autosave made from these exact bytes carries the edits
			// (and undo history) since; a file changed in StarUML never matches.
			const sourceHash = await hashBytes(f.data);
			const saved = findBySourceHash(sourceHash);
			if (saved && (await openSaved(saved.id))) {
				files.notice = { kind: 'restored', file: f.name };
			} else {
				const result = await parseInWorker(f.data);
				startFresh();
				projectStore.load(result.project, result.openDiagramId);
				files.origin = { kind: 'staruml', sourceHash, fileName: f.name };
				files.notice = { kind: 'opened', file: f.name, report: result.report };
			}
		}
		files.current = { name: f.name, format, handle: f.handle };
		files.knownModified = f.handle ? (f.lastModified ?? null) : null;
		files.savedVersion = projectStore.version;
		files.lastSavedAt = null;
		files.bannerDismissed = false;
		mintSlug();
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: f.name,
			message: e instanceof Error ? e.message : String(e),
			invalid: e instanceof MdjError || e instanceof AsterError
		};
	} finally {
		canvasFocus.focus();
	}
}

/**
 * Board 20: edits to a file-backed project ask before another project replaces them. Projects
 * that live only in the browser are autosaved, so they just go to Recent.
 */
export function guardUnsaved(nextName: string | null, run: () => Promise<void>): Promise<void> {
	if (files.state !== 'unsaved') return run();
	files.pending = { nextName, run };
	return Promise.resolve();
}

export async function openFromPicker() {
	try {
		const f = await pickFile();
		if (f) await guardUnsaved(f.name, () => openFile(f));
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: '',
			message: e instanceof Error ? e.message : String(e),
			invalid: false
		};
	}
}

/** A drop anywhere on the window opens the first file. */
export async function openDropped(list: FileList | null | undefined) {
	files.dragging = false;
	const f = list?.[0];
	if (!f) return;
	const data = await f.arrayBuffer();
	await guardUnsaved(f.name, () => openFile({ name: f.name, data }));
}

/**
 * ⌘N: an untitled project with one empty class diagram (board 18). `refocus` is off when the
 * editor boots into it: the canvas took focus as it mounted, and a reader may already be elsewhere.
 */
export function newProject(refocus = true): Promise<void> {
	return guardUnsaved(null, async () => {
		const project = createProject({ name: t('model.untitled') });
		project.diagrams.push(createDiagram({ name: t('model.newDiagramName') }));
		startFresh();
		projectStore.load(project);
		files.current = null;
		files.origin = null;
		files.savedVersion = projectStore.version;
		files.lastSavedAt = null;
		files.bannerDismissed = false;
		persist.route = 'new';
		// After the menu that triggered this closes and puts focus back on its trigger.
		if (refocus) requestAnimationFrame(() => canvasFocus.focus());
	});
}

/** The text of the project in a format. */
export const fileText = (format: FileFormat) =>
	format === 'mdj'
		? serializeMdjText(projectStore.project)
		: serializeAsterText(projectStore.project, files.origin ?? undefined);

/**
 * What a downloaded or saved file is called, without its extension: the open file's own name
 * (StarUML names its projects "Untitled" inside the file), else the project's name, else the
 * diagram's. Owner's report, 2026-10-21: everything had come down as untitled.mdj.
 */
export function baseName(): string {
	const own = files.current?.name.replace(/\.(aster(\.json)?|mdj|puml)$/i, '');
	if (own) return own;
	const p = projectStore.project;
	if (p.name.trim() && p.name !== t('model.untitled')) return slug(p.name);
	return slug(projectStore.diagram.name) || 'diagram';
}

/** A file name for the format: the open file's own when the format matches; never a doubled extension. */
export const suggestedName = (format: FileFormat) =>
	files.current?.format === format ? files.current.name : `${baseName()}.${format}`;

/**
 * ⌘S (owner's ruling, 2026-10-21): never a dialog. A file the project is linked to is written
 * once the browser allows it (after a reload Chrome asks with its own small bar, not the file
 * picker); otherwise the browser copy is brought up to date and the notice offers a download.
 * ⌘⇧S, and the unsaved-changes prompt's Save, are where a file is asked for (saveFile).
 */
export async function quickSave(): Promise<void> {
	const handle = files.current?.handle;
	if (handle && (await mayWrite(handle))) {
		await saveFile();
		return;
	}
	await flush();
	ui.toast = { text: t('toast.savedInBrowser'), undo: false, save: true, at: Date.now() };
}

/** File System Access permissions are Chromium's; where the API is missing, a handle is writable. */
interface Permissioned {
	queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
	requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
}
async function mayWrite(handle: FileSystemFileHandle): Promise<boolean> {
	const h = handle as FileSystemFileHandle & Permissioned;
	const mode = { mode: 'readwrite' } as const;
	try {
		if (!h.queryPermission || (await h.queryPermission(mode)) === 'granted') return true;
		return (await h.requestPermission?.(mode)) === 'granted';
	} catch {
		return false; // the file moved, or the prompt could not be shown: keep it in the browser
	}
}

/**
 * Writes back in the format the file was opened as (an Aster-born project writes `.aster`);
 * `as` (⌘⇧S) or no handle asks where, either format, or downloads. A written `.mdj` becomes the
 * origin.
 */
export async function saveFile(as = false): Promise<boolean> {
	if (files.saving) return false;
	files.saving = true;
	try {
		let format: FileFormat = files.current?.format ?? 'aster';
		let handle = as ? undefined : files.current?.handle;
		if (!handle && window.showSaveFilePicker) {
			try {
				handle = await window.showSaveFilePicker({
					suggestedName: suggestedName(format),
					types: format === 'aster' ? TYPES : [TYPES[1], TYPES[0]]
				});
				format = formatOf(handle.name);
			} catch (e) {
				if (e instanceof DOMException && e.name === 'AbortError') return false;
				throw e;
			}
		}
		const text = fileText(format);
		let name: string;
		if (handle) {
			const w = await handle.createWritable();
			await w.write(text);
			await w.close();
			name = handle.name;
			files.knownModified = (await handle.getFile()).lastModified;
		} else {
			name = suggestedName(format);
			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
			a.download = name;
			a.hidden = true;
			document.body.append(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		}
		if (format === 'mdj')
			files.origin = { kind: 'staruml', sourceHash: await hashBytes(text), fileName: name };
		files.current = { name, format, handle };
		files.savedVersion = projectStore.version;
		files.lastSavedAt = Date.now();
		mintSlug();
		return true;
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: files.current?.name ?? '',
			message: e instanceof Error ? e.message : String(e),
			invalid: false
		};
		return false;
	} finally {
		files.saving = false;
	}
}

/** The prompt's three answers. */
export async function resolvePending(answer: 'save' | 'discard' | 'cancel') {
	const p = files.pending;
	files.pending = null;
	if (!p || answer === 'cancel') return;
	if (answer === 'save' && !(await saveFile())) return;
	await p.run();
}

/**
 * Owner's ruling #22: the open file changed on disk (StarUML saved it, say). Checked every 5 s
 * while the window has focus and as soon as it gets focus back; a change asks Reload or Keep
 * mine once, through the notice. Files without a handle (dropped, downloaded) are not watched.
 */
export async function checkOutside() {
	const handle = files.current?.handle;
	const known = files.knownModified;
	if (!handle || known === null || files.notice?.kind === 'changed') return;
	let file: File;
	try {
		file = await handle.getFile();
	} catch {
		return; // moved or permission withdrawn: nothing to compare
	}
	if (file.lastModified > known)
		files.notice = { kind: 'changed', file: file.name, lastModified: file.lastModified };
}
export const WATCH_MS = 5000;
export function watchOutside(): () => void {
	const tick = () => {
		if (document.hasFocus()) void checkOutside();
	};
	const id = setInterval(tick, WATCH_MS);
	window.addEventListener('focus', checkOutside);
	return () => {
		clearInterval(id);
		window.removeEventListener('focus', checkOutside);
	};
}
/** Keep mine: the edits here stand; this disk time is not asked about again. */
export function keepMine() {
	if (files.notice?.kind === 'changed') files.knownModified = files.notice.lastModified;
	files.notice = null;
}
/** Reload: read the file again from its handle, as ⌘O would. */
export async function reloadFromDisk() {
	const handle = files.current?.handle;
	if (!handle) return;
	const file = await handle.getFile();
	await openFile({
		name: file.name,
		data: await file.arrayBuffer(),
		handle,
		lastModified: file.lastModified
	});
}

// ---------------------------------------------------------------------------
// PlantUML (features.md M2, Text view: ".puml import and export")
// ---------------------------------------------------------------------------

const isPuml = (f: OpenedFile) =>
	/\.puml$/i.test(f.name) ||
	/^\s*@startuml/.test(new TextDecoder('utf-8').decode(f.data.slice(0, 64)));

/** A `.puml` opens as a new project, one diagram, the classes on a grid; it lives in the browser until saved. */
async function openPuml(f: OpenedFile) {
	const doc = parsePuml(new TextDecoder('utf-8').decode(f.data));
	if (doc.errors.length) {
		files.notice = {
			kind: 'failed',
			file: f.name,
			message: t('text.error.missingBrace', {
				line: doc.errors[0].line,
				name: doc.errors[0].name ?? ''
			}),
			invalid: true
		};
		return;
	}
	const name = f.name.replace(/\.puml$/i, '') || t('model.untitled');
	const project = createProject({ name });
	const diagram = createDiagram({ name: t('model.newDiagramName') });
	project.diagrams.push(diagram);
	let k = 0;
	const plan = planSync(project, diagram.id, doc, {
		place: () => ({ x: 40 + (k % 4) * 240, y: 40 + Math.floor(k++ / 4) * 220 })
	});
	if (plan) new Stack(() => project).run(batch(project, plan));
	startFresh();
	projectStore.load(project);
	files.current = null;
	files.origin = null;
	files.knownModified = null;
	files.savedVersion = projectStore.version;
	files.lastSavedAt = null;
	files.notice = { kind: 'imported', file: f.name };
	// Named after its file, so it has a route as an opened .mdj does (the welcome goes there).
	mintSlug();
	canvasFocus.focus();
}

/** The open diagram as `<diagram>.puml`, downloaded. */
export function exportPuml() {
	const d = projectStore.diagram;
	const a = document.createElement('a');
	a.href = URL.createObjectURL(
		new Blob([printDiagram(projectStore.project, d)], { type: 'text/plain' })
	);
	a.download = `${slug(d.name) || 'diagram'}.puml`;
	a.hidden = true;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Ask for a `.puml` file only. */
const pickPuml = () => pickFile(PUML_TYPES, '.puml,text/plain');
/** StarUML writes fragments as `.mfj`; a whole `.mdj` comes in as its contents. */
const FRAGMENT_TYPES = [
	{ description: 'StarUML model fragment', accept: { 'application/json': ['.mfj', '.mdj'] } }
];

/**
 * features.md M3, fragment import (StarUML's File › Import › Fragment): a `.mfj` into the model
 * under the selected package, else the top of the model; one undo step, said in a toast with Undo.
 * Nothing is placed on the open diagram; diagrams inside come as tabs (owner's ruling, 2026-10-22).
 */
export async function importFragmentFile() {
	const f = await pickFile(FRAGMENT_TYPES, '.mfj,.mdj,application/json').catch(() => null);
	if (!f) return;
	try {
		const text = new TextDecoder('utf-8').decode(f.data).replace(/^\uFEFF/, '');
		const sel =
			selection.size === 1 ? projectStore.project.elements.get(selection.list[0]) : undefined;
		const { payload, report } = readFragment(
			JSON.parse(text),
			projectStore.project,
			sel?.kind === 'package' ? sel.id : undefined
		);
		projectStore.run(importFragment, payload);
		const count = (key: 'classes' | 'diagrams', n: number) =>
			n ? [t(`toast.fragment.${key}.${n === 1 ? 'one' : 'other'}`, { count: n })] : [];
		const what = [
			...count('classes', report.model.classifiers),
			...count('diagrams', report.diagrams.length)
		];
		ui.toast = {
			text: t('toast.fragment', {
				name: payload.name,
				what: what.join(', ') || t('toast.fragment.nothing')
			}),
			undo: true,
			at: Date.now()
		};
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: f.name,
			message: e instanceof Error ? e.message : String(e),
			invalid: e instanceof MdjError || e instanceof SyntaxError
		};
	}
}

/** The Text view's import: a `.puml` file's text for this diagram, or null when cancelled. */
export async function pickPumlText(): Promise<string | null> {
	const f = await pickPuml();
	return f ? new TextDecoder('utf-8').decode(f.data) : null;
}

/** The project menu's import: a `.puml` file as a new project (asking first about unsaved edits). */
export async function importPumlProject() {
	const f = await pickPuml();
	if (f) await guardUnsaved(f.name, () => openPuml(f));
}
