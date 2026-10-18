/**
 * Autosave to IndexedDB (features.md: "Close mid-edit and reopen: nothing lost"): every change,
 * debounced 300 ms, writes the project, its layout and the undo history under the project id;
 * the last 10 projects make the Recent list, each with a thumbnail drawn at save time.
 */
import { del, get, set } from 'idb-keyval';
import { parseAster, serializeAster, type AsterFile } from '#lib/aster/index.ts';
import { canvasRects } from '#lib/canvas/focus.ts';
import type { CommandStackSnapshot } from '#lib/commands/types.ts';
import { blobToDataUrl, svgToPng } from '#lib/export/image.ts';
import { diagramToSvg } from '#lib/export/svg.ts';
import type { Id, Project } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { files, type FileFormat } from './files.svelte.ts';

/** Autosave record, version 2: the project as an `.aster` document (docs/file-format.md) plus history. */
export interface Saved {
	version: 2;
	file: AsterFile;
	activeDiagramId: Id;
	history: CommandStackSnapshot;
	/** The file this project was opened from or saved to, when any. */
	fileName: string | null;
	fileFormat: FileFormat | null;
	/** projectStore.version at the last file save, so "unsaved changes" survives a reload. */
	savedVersion: number;
	version_: number;
	at: number;
	thumbnail?: string;
	bannerDismissed: boolean;
}
/** The first records (before the .aster format) held the Project by structured clone. */
interface SavedV1 extends Omit<Saved, 'version' | 'file' | 'fileFormat'> {
	version: 1;
	project: Project;
}
export interface RecentEntry {
	/** The record key (project id, plus the file name when it has one). */
	id: string;
	name: string;
	fileName: string | null;
	/** Hash of the .mdj this project came from, so opening that file again restores the record. */
	sourceHash?: string;
	at: number;
	thumbnail?: string;
}

const KEY = (key: string) => `aster:project:${key}`;
/**
 * Record key: the project id plus the file name. StarUML files made from its template share one
 * project id, so two opened files must not overwrite each other.
 */
const recordKey = (p: Project) => (files.current ? `${p.id}@${files.current.name}` : p.id);
const RECENT = 'aster:recent';
const LAST = 'aster:last';
const SEEN = 'aster:seen';
export const DEBOUNCE_MS = 300;
const RECENT_MAX = 10;
export const currentKey = () => recordKey(projectStore.project);
const THUMB_WIDTH = 320;
const THUMB_MAX_NODES = 60;
const THUMB_TIMEOUT_MS = 2000;

class Persist {
	/** When the last autosave finished, for the footer. */
	at: number | null = $state(null);
	saving = $state(false);
	recent: RecentEntry[] = $state([]);
	/** The autosave record of the open project has been read or written (restore finished). */
	ready = $state(false);
}
export const persist = new Persist();

let timer = 0;
let pending: Promise<void> | null = null;

/** The open project to IndexedDB, now. */
export async function saveNow(): Promise<void> {
	const p = projectStore.project;
	const diagram = projectStore.diagram;
	persist.saving = true;
	const thumb = await thumbnail(p, diagram.id);
	const record: Saved = {
		version: 2,
		file: serializeAster(p, files.origin ?? undefined),
		activeDiagramId: projectStore.activeDiagramId,
		history: projectStore.snapshot(),
		fileName: files.current?.name ?? null,
		fileFormat: files.current?.format ?? null,
		savedVersion: files.savedVersion,
		version_: projectStore.version,
		at: Date.now(),
		thumbnail: thumb,
		bannerDismissed: files.bannerDismissed
	};
	const key = recordKey(p);
	await set(KEY(key), record);
	await set(LAST, key);
	const entry: RecentEntry = {
		id: key,
		name: p.name,
		fileName: record.fileName,
		...(files.origin && { sourceHash: files.origin.sourceHash }),
		at: record.at,
		thumbnail: record.thumbnail
	};
	persist.recent = [entry, ...persist.recent.filter((r) => r.id !== key)].slice(0, RECENT_MAX);
	await set(RECENT, $state.snapshot(persist.recent));
	persist.at = record.at;
	persist.saving = false;
	persist.ready = true;
}

/** A small PNG of the diagram for the Recent list; skipped for big diagrams. */
async function thumbnail(project: Project, diagramId: Id): Promise<string | undefined> {
	const diagram = project.diagrams.find((d) => d.id === diagramId);
	if (!diagram || typeof document === 'undefined') return undefined;
	try {
		const rects = canvasRects.get();
		if (rects.size === 0 || rects.size > THUMB_MAX_NODES) return undefined;
		const { svg, width, height } = diagramToSvg(project, diagram, rects, { background: 'white' });
		const scale = Math.min(1, THUMB_WIDTH / width);
		// ponytail: scale through a 1× render sized down; fine for a 320 px preview
		const blob = await Promise.race([
			svgToPng(svg, width * scale, height * scale, 1),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('thumbnail timed out')), THUMB_TIMEOUT_MS)
			)
		]);
		return await blobToDataUrl(blob);
	} catch {
		return undefined;
	}
}

function schedule() {
	clearTimeout(timer);
	timer = window.setTimeout(() => {
		pending = saveNow().catch((e) => console.error('autosave failed', e));
	}, DEBOUNCE_MS);
}

/** Wait for a scheduled or running save (tests, before unload). */
export async function flush() {
	clearTimeout(timer);
	await pending;
	await saveNow();
}

/** Start saving on every change. Returns the stop function. */
export function startAutosave(): () => void {
	return $effect.root(() => {
		let first = true;
		$effect(() => {
			void projectStore.version;
			void projectStore.activeDiagramId;
			void files.current;
			void files.bannerDismissed;
			if (first) {
				first = false;
				return;
			}
			schedule();
		});
		return () => clearTimeout(timer);
	});
}

/** The autosave entry made from exactly these .mdj bytes, when there is one. */
export const findBySourceHash = (hash: string) => persist.recent.find((r) => r.sourceHash === hash);

export async function loadRecent(): Promise<RecentEntry[]> {
	persist.recent = (await get<RecentEntry[]>(RECENT)) ?? [];
	return persist.recent;
}

/** Open a project from its autosave record, with its undo history. */
export async function openSaved(id: string): Promise<boolean> {
	const record = await get<Saved | SavedV1>(KEY(id));
	if (!record) {
		persist.recent = persist.recent.filter((r) => r.id !== id);
		await set(RECENT, $state.snapshot(persist.recent));
		return false;
	}
	let project: Project;
	let origin = null;
	if (record.version === 2) {
		const parsed = parseAster(record.file);
		project = parsed.project;
		origin = parsed.origin ?? null;
	} else project = record.project;
	projectStore.load(project, record.activeDiagramId, record.history);
	files.current = record.fileName
		? {
				name: record.fileName,
				format: record.version === 2 ? (record.fileFormat ?? 'mdj') : 'mdj'
			}
		: null;
	files.origin = origin;
	// The version counter restarts on load: keep "saved" relative to the new count.
	files.savedVersion =
		record.savedVersion === record.version_ ? projectStore.version : projectStore.version - 1;
	files.bannerDismissed = record.bannerDismissed;
	persist.at = record.at;
	persist.ready = true;
	return true;
}

/** Returning visit: the last project. First visit: nothing (the caller shows the welcome). */
export async function restoreLast(): Promise<boolean> {
	await loadRecent();
	const last = await get<string>(LAST);
	return last ? openSaved(last) : false;
}

export async function forget(id: string) {
	await del(KEY(id));
	persist.recent = persist.recent.filter((r) => r.id !== id);
	await set(RECENT, $state.snapshot(persist.recent));
}

/** First visit flag, synchronous so the welcome can show before IndexedDB answers. */
export const firstVisit = () =>
	typeof localStorage !== 'undefined' && localStorage.getItem(SEEN) === null;
export const markSeen = () => localStorage.setItem(SEEN, '1');
