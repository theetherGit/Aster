/**
 * Opening `.mdj` files: the ⌘O picker (File System Access when available, an
 * <input type=file> otherwise), drops on the window, and this session's recent files.
 * Persistent recents with thumbnails arrive with autosave (day 5).
 */
import { canvasFocus } from '#lib/canvas/focus.ts';
import { MdjError, type ParseReport } from '#lib/mdj/parse.ts';
import { parseInWorker } from '#lib/mdj/worker.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';

export interface OpenedFile {
	name: string;
	data: ArrayBuffer;
	/** Kept for saving back to the same file (day 5). */
	handle?: FileSystemFileHandle;
}

export type ImportNotice =
	| { kind: 'opening'; file: string }
	| { kind: 'opened'; file: string; report: ParseReport }
	| { kind: 'failed'; file: string; message: string; invalid: boolean };

interface RecentFile {
	name: string;
	at: number;
	/** ponytail: session-only recents keep the bytes; IndexedDB recents replace this on day 5 */
	data: ArrayBuffer;
	handle?: FileSystemFileHandle;
}

class Files {
	notice: ImportNotice | null = $state(null);
	recent: RecentFile[] = $state([]);
	dragging = $state(false);
	current: { name: string; handle?: FileSystemFileHandle } | null = $state(null);
}

export const files = new Files();

const ACCEPT = { 'application/json': ['.mdj'] };

/** ⌘O: ask for a file. Resolves to null when the user cancels. */
export async function pickFile(): Promise<OpenedFile | null> {
	if (window.showOpenFilePicker) {
		try {
			const [handle] = await window.showOpenFilePicker({
				types: [{ description: 'StarUML model', accept: ACCEPT }],
				multiple: false
			});
			const file = await handle.getFile();
			return { name: file.name, data: await file.arrayBuffer(), handle };
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return null;
			throw e;
		}
	}
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.mdj,application/json';
		input.addEventListener(
			'change',
			async () => {
				const f = input.files?.[0];
				resolve(f ? { name: f.name, data: await f.arrayBuffer() } : null);
			},
			{ once: true }
		);
		input.addEventListener('cancel', () => resolve(null), { once: true });
		input.click();
	});
}

/** Parse in the worker, then make the result the open project; the notice shows the report. */
export async function openFile(f: OpenedFile) {
	files.notice = { kind: 'opening', file: f.name };
	const keep = f.data.slice(0);
	try {
		const result = await parseInWorker(f.data);
		ui.link = null;
		ui.picker = null;
		selection.editing = null;
		selection.clear();
		projectStore.load(result.project);
		files.current = { name: f.name, handle: f.handle };
		files.recent = [
			{ name: f.name, at: Date.now(), data: keep, handle: f.handle },
			...files.recent.filter((r) => r.name !== f.name)
		].slice(0, 8);
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

export async function openFromPicker() {
	try {
		const f = await pickFile();
		if (f) await openFile(f);
	} catch (e) {
		files.notice = {
			kind: 'failed',
			file: '',
			message: e instanceof Error ? e.message : String(e),
			invalid: false
		};
	}
}

export async function openRecent(name: string) {
	const r = files.recent.find((x) => x.name === name);
	if (r) await openFile({ name: r.name, data: r.data.slice(0), handle: r.handle });
}

/** A drop anywhere on the window opens the first file. */
export async function openDropped(list: FileList | null | undefined) {
	files.dragging = false;
	const f = list?.[0];
	if (f) await openFile({ name: f.name, data: await f.arrayBuffer() });
}
