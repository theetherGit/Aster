/**
 * Files: open (⌘O picker, File System Access when available, an <input type=file> otherwise;
 * drops on the window), save (⌘S back to the handle, else a download), save as (⌘⇧S), the
 * unsaved-changes guard (board 20) and the three save states (ui.md: saved, unsaved, never saved).
 */
import { canvasFocus } from '#lib/canvas/focus.ts';
import { t } from '#lib/i18n/index.ts';
import { MdjError, type ParseReport } from '#lib/mdj/parse.ts';
import { serializeMdjText } from '#lib/mdj/serialize.ts';
import { parseInWorker } from '#lib/mdj/worker.ts';
import { slug } from '#lib/export/svg.ts';
import { createDiagram, createProject } from '#lib/model/project.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';

export interface OpenedFile {
	name: string;
	data: ArrayBuffer;
	handle?: FileSystemFileHandle;
}

export type ImportNotice =
	| { kind: 'opening'; file: string }
	| { kind: 'opened'; file: string; report: ParseReport }
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
	/** The file this project lives in, when it has one. */
	current: { name: string; handle?: FileSystemFileHandle } | null = $state(null);
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

const ACCEPT = { 'application/json': ['.mdj'] };
const TYPES = [{ description: 'StarUML model', accept: ACCEPT }];

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
		input.accept = '.mdj,application/json';
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

/** Parse in the worker, then make the result the open project; the notice shows the report. */
export async function openFile(f: OpenedFile) {
	files.notice = { kind: 'opening', file: f.name };
	try {
		const result = await parseInWorker(f.data);
		startFresh();
		projectStore.load(result.project, result.openDiagramId);
		files.current = { name: f.name, handle: f.handle };
		files.savedVersion = projectStore.version;
		files.lastSavedAt = null;
		files.bannerDismissed = false;
		files.notice = { kind: 'opened', file: f.name, report: result.report };
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: f.name,
			message: e instanceof Error ? e.message : String(e),
			invalid: e instanceof MdjError
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
		files.savedVersion = projectStore.version;
		files.lastSavedAt = null;
		files.bannerDismissed = false;
		// After the menu that triggered this closes and puts focus back on its trigger.
		requestAnimationFrame(() => canvasFocus.focus());
	});
}

const suggestedName = () => files.current?.name ?? `${slug(projectStore.project.name)}.mdj`;

/** ⌘S writes back to the opened handle; ⌘⇧S (or no handle) asks where, or downloads. */
export async function saveFile(as = false): Promise<boolean> {
	if (files.saving) return false;
	files.saving = true;
	try {
		const text = serializeMdjText(projectStore.project);
		let handle = as ? undefined : files.current?.handle;
		if (!handle && window.showSaveFilePicker) {
			try {
				handle = await window.showSaveFilePicker({ suggestedName: suggestedName(), types: TYPES });
			} catch (e) {
				if (e instanceof DOMException && e.name === 'AbortError') return false;
				throw e;
			}
		}
		if (handle) {
			const w = await handle.createWritable();
			await w.write(text);
			await w.close();
			files.current = { name: handle.name, handle };
		} else {
			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
			a.download = suggestedName();
			a.hidden = true;
			document.body.append(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
			files.current = { name: a.download };
		}
		files.savedVersion = projectStore.version;
		files.lastSavedAt = Date.now();
		return true;
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: suggestedName(),
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
