/**
 * Autosave to IndexedDB (features.md: "Close mid-edit and reopen: nothing lost"): every change,
 * debounced 300 ms, writes the project, its layout and the undo history under the project id;
 * the last 10 projects make the Recent list, each with a thumbnail drawn at save time.
 */
import { del, get, set } from 'idb-keyval';
import { useDebounce, watch } from 'runed';
import { parseAster, serializeAster, type AsterFile } from '#lib/aster/index.ts';
import { canvasRects } from '#lib/canvas/focus.ts';
import type { CommandStackSnapshot } from '#lib/commands/types.ts';
import { blobToDataUrl, svgToPng } from '#lib/export/image.ts';
import { diagramToSvg } from '#lib/export/svg.ts';
import { t } from '#lib/i18n/index.ts';
import type { Id, Project } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { files, type FileFormat } from './files.svelte.ts';
import { uniqueSlug } from './slug.ts';

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
	/** The project's `/design/<slug>`; null for an unnamed draft. */
	slug?: string | null;
	/**
	 * The file it is linked to, so ⌘S keeps writing it after a reload (owner's ruling,
	 * 2026-10-21). File System Access handles survive IndexedDB; the permission does not.
	 */
	handle?: FileSystemFileHandle;
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
	slug?: string | null;
}

const KEY = (key: string) => `aster:project:${key}`;
/**
 * Record key: the project id plus the file name. StarUML files made from its template share one
 * project id, so two opened files must not overwrite each other.
 */
const recordKey = (p: Project) => (files.current ? `${p.id}@${files.current.name}` : p.id);
const RECENT = 'aster:recent';
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
	/** The open project's slug, once it has a name; null for a draft. */
	slug: string | null = $state(null);
	/** What `/design/<route>` the open project answers to: its slug, or `new`, `sample`, `notation`. Null before anything loads. */
	route: string | null = $state(null);
}
export const persist = new Persist();

let pending: Promise<void> | null = null;

/** The open project to IndexedDB, now. */
/** Mint the slug once the project has a name: its file, or a project name that is not the untitled default. */
export function mintSlug() {
	if (persist.slug) return;
	const p = projectStore.project;
	const name = files.current?.name ?? (p.name !== t('model.untitled') ? p.name : null);
	if (!name) return;
	const key = recordKey(p);
	persist.slug = uniqueSlug(
		name,
		persist.recent.filter((r) => r.id !== key).map((r) => r.slug)
	);
	persist.route = persist.slug;
}

export async function saveNow(): Promise<void> {
	const p = projectStore.project;
	const diagram = projectStore.diagram;
	persist.saving = true;
	mintSlug();
	const thumb = await thumbnailOf(p, diagram.id);
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
		bannerDismissed: files.bannerDismissed,
		slug: persist.slug,
		handle: files.current?.handle
	};
	const key = recordKey(p);
	try {
		await set(KEY(key), record);
	} catch (e) {
		// A handle IndexedDB cannot hold (a test double, an older browser): keep the rest.
		if (!(e instanceof DOMException && e.name === 'DataCloneError') || !record.handle) throw e;
		await set(KEY(key), { ...record, handle: undefined });
	}
	const entry: RecentEntry = {
		id: key,
		name: p.name,
		fileName: record.fileName,
		...(files.origin && { sourceHash: files.origin.sourceHash }),
		at: record.at,
		thumbnail: record.thumbnail,
		slug: persist.slug
	};
	persist.recent = [entry, ...persist.recent.filter((r) => r.id !== key)].slice(0, RECENT_MAX);
	await set(RECENT, $state.snapshot(persist.recent));
	persist.at = record.at;
	persist.saving = false;
	persist.ready = true;
}

/**
 * A small PNG of a diagram: the Recent list's thumbnails, and the welcome's sample card. Rendered
 * nodes come from `rects` (the live canvas by default); the rest fall back to the layout's sizes.
 * Skipped for big diagrams.
 */
export async function thumbnailOf(
	project: Project,
	diagramId: Id,
	rects: ReadonlyMap<Id, { x: number; y: number; w: number; h: number }> = canvasRects.get(),
	maxWidth = THUMB_WIDTH
): Promise<string | undefined> {
	const diagram = project.diagrams.find((d) => d.id === diagramId);
	if (!diagram || typeof document === 'undefined') return undefined;
	try {
		if (rects.size > THUMB_MAX_NODES) return undefined;
		const { svg, width, height } = diagramToSvg(project, diagram, rects, { background: 'white' });
		const scale = Math.min(1, maxWidth / width);
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

const schedule = useDebounce(() => {
	pending = saveNow().catch((e) => console.error('autosave failed', e));
}, DEBOUNCE_MS);

/** Wait for a scheduled or running save (tests, before unload). */
export async function flush() {
	schedule.cancel();
	await pending;
	await saveNow();
}

/** Start saving on every change. Returns the stop function. */
export function startAutosave(): () => void {
	return $effect.root(() => {
		watch(
			() => [
				projectStore.version,
				projectStore.activeDiagramId,
				files.current,
				files.bannerDismissed
			],
			() => void schedule(),
			{ lazy: true }
		);
		return () => schedule.cancel();
	});
}

/** The autosave entry made from exactly these .mdj bytes, when there is one. */
export const findBySourceHash = (hash: string) => persist.recent.find((r) => r.sourceHash === hash);

/** A record is a draft when nothing names it: no file, and the untitled default as its name. */
const isDraft = (r: RecentEntry) => !r.fileName && r.name === t('model.untitled');

export async function loadRecent(): Promise<RecentEntry[]> {
	const recent = (await get<RecentEntry[]>(RECENT)) ?? [];
	// Entries from before slugs: a named one gets its slug now, so it is never taken for the draft.
	let migrated = false;
	for (const r of recent) {
		if (r.slug || isDraft(r)) continue;
		r.slug = uniqueSlug(
			r.fileName ?? r.name,
			recent.filter((o) => o !== r).map((o) => o.slug)
		);
		migrated = true;
	}
	persist.recent = recent;
	if (migrated) await set(RECENT, $state.snapshot(recent));
	return recent;
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
		let parsed: ReturnType<typeof parseAster>;
		try {
			parsed = parseAster(record.file);
		} catch (e) {
			// A record this build cannot read (board 22): say so, leave what is open alone.
			files.notice = {
				kind: 'failed',
				file: record.fileName ?? t('model.untitled'),
				message: e instanceof Error ? e.message : String(e),
				invalid: true
			};
			return false;
		}
		project = parsed.project;
		origin = parsed.origin ?? null;
	} else project = record.project;
	projectStore.load(project, record.activeDiagramId, record.history);
	files.current = record.fileName
		? {
				name: record.fileName,
				format: record.version === 2 ? (record.fileFormat ?? 'mdj') : 'mdj',
				handle: record.version === 2 ? record.handle : undefined
			}
		: null;
	files.origin = origin;
	// The version counter restarts on load: keep "saved" relative to the new count.
	files.savedVersion =
		record.savedVersion === record.version_ ? projectStore.version : projectStore.version - 1;
	files.bannerDismissed = record.bannerDismissed;
	persist.at = record.at;
	persist.ready = true;
	// The record's slug, or the one the Recent list minted for an older record; a draft has none.
	persist.slug = record.slug ?? persist.recent.find((r) => r.id === id)?.slug ?? null;
	persist.route = persist.slug ?? 'new';
	mintSlug();
	return true;
}

/** `/design/<slug>`: the project with that slug, when this browser has it. */
export async function openBySlug(slug: string): Promise<boolean> {
	const entry = persist.recent.find((r) => r.slug === slug);
	return entry ? openSaved(entry.id) : false;
}

/** `/design/new` on a reload: the newest unnamed draft, when there is one. */
export async function openDraft(): Promise<boolean> {
	const draft = persist.recent.find((r) => !r.slug && isDraft(r));
	return draft ? openSaved(draft.id) : false;
}

export async function forget(id: string) {
	await del(KEY(id));
	persist.recent = persist.recent.filter((r) => r.id !== id);
	await set(RECENT, $state.snapshot(persist.recent));
}

/** Board 23 "Clear": every record and the Recent list go; the open project is saved again on its next change. */
export async function clearRecent() {
	await Promise.all(persist.recent.map((r) => del(KEY(r.id))));
	persist.recent = [];
	await del(RECENT);
}
