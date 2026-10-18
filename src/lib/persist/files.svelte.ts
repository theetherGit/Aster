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
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import { findBySourceHash, openSaved } from './autosave.svelte.ts';

export type FileFormat = 'mdj' | 'aster';

export interface OpenedFile {
	name: string;
	data: ArrayBuffer;
	handle?: FileSystemFileHandle;
}

export type ImportNotice =
	| { kind: 'opening'; file: string }
	| { kind: 'opened'; file: string; report: ParseReport }
	| { kind: 'restored'; file: string }
	| { kind: 'failed'; file: string; message: string; invalid: boolean };

/** Board 20: what the user was about to do when the prompt opened. */
export interface PendingAction {
	/** The file about to open, or null for a new project. */
	nextName: string | null;
	run: () => Promise<void>;
}

class Files {
	notice: ImportNotice | null = $state(null);
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
	/** ui.md's three states. */
	get state(): 'saved' | 'unsaved' | 'never' {
		if (!this.current) return 'never';
		return this.dirty ? 'unsaved' : 'saved';
	}
}

export const files = new Files();

const TYPES = [
	{ description: 'Aster project', accept: { 'application/json': ['.aster', '.aster.json'] } },
	{ description: 'StarUML model', accept: { 'application/json': ['.mdj'] } }
];
export const formatOf = (name: string): FileFormat =>
	/\.aster(\.json)?$/i.test(name) ? 'aster' : 'mdj';

/** ⌘O: ask for a file. Resolves to null when the user cancels. */
export async function pickFile(): Promise<OpenedFile | null> {
	if (window.showOpenFilePicker) {
		try {
			const [handle] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
			const file = await handle.getFile();
			return { name: file.name, data: await file.arrayBuffer(), handle };
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return null;
			throw e;
		}
	}
	return new Promise((resolve) => {
		// Attached while the chooser is open: a detached input has nothing keeping it alive.
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.mdj,.aster,.aster.json,application/json';
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
	ui.welcome = false;
	ui.sampleStrip = false;
	selection.editing = null;
	selection.clear();
}

/** Open a file: `.aster` validates and loads; `.mdj` restores its autosave on a hash match, else parses. */
export async function openFile(f: OpenedFile) {
	files.notice = { kind: 'opening', file: f.name };
	const format = formatOf(f.name);
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
		files.savedVersion = projectStore.version;
		files.lastSavedAt = null;
		files.bannerDismissed = false;
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

/** ⌘N: an untitled project with one empty class diagram (board 18). */
export function newProject(): Promise<void> {
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
		// After the menu that triggered this closes and puts focus back on its trigger.
		requestAnimationFrame(() => canvasFocus.focus());
	});
}

/** The text of the project in a format. */
export const fileText = (format: FileFormat) =>
	format === 'mdj'
		? serializeMdjText(projectStore.project)
		: serializeAsterText(projectStore.project, files.origin ?? undefined);

const suggestedName = (format: FileFormat) =>
	files.current?.format === format
		? files.current.name
		: `${slug(projectStore.project.name)}.${format}`;

/**
 * ⌘S writes back in the format the file was opened as (an Aster-born project writes `.aster`);
 * ⌘⇧S or no handle asks where, either format, or downloads. A written `.mdj` becomes the origin.
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
