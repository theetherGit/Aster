/**
 * `.aster` codec (docs/file-format.md): `serializeAster` and its exact inverse `parseAster`,
 * `migrate` for future versions, `lossReport` (empty in v1 by construction) and the byte hash
 * that ties an mdj-born project to its source file.
 */
import {
	DEFAULT_DISPLAY_FLAGS,
	type Diagram,
	type Layout,
	type Project
} from '#lib/model/types.ts';
import { ASTER_SCHEMA, ASTER_VERSION, type AsterFile, type AsterOrigin } from './format.ts';
import { AsterError, validateAsterFile } from './schema.ts';

export { ASTER_SCHEMA, ASTER_VERSION, AsterError };
export type { AsterFile, AsterOrigin };

/** The project as an `.aster` document: Maps to objects (insertion order), Sets to arrays. */
export function serializeAster(project: Project, origin?: AsterOrigin): AsterFile {
	// Through JSON once, so `undefined` fields are gone and the result is a plain tree.
	const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
	return {
		$schema: ASTER_SCHEMA,
		version: ASTER_VERSION,
		meta: { app: 'Aster', savedAt: new Date().toISOString() },
		...(origin && { origin: plain(origin) }),
		project: plain({
			id: project.id,
			name: project.name,
			elements: Object.fromEntries(project.elements),
			diagrams: project.diagrams.map((d) => ({ ...d, layout: Object.fromEntries(d.layout) })),
			unknown: project.unknown,
			importedIds: [...project.importedIds]
		})
	};
}

export const serializeAsterText = (project: Project, origin?: AsterOrigin) =>
	JSON.stringify(serializeAster(project, origin), null, '\t');

/**
 * Fields the model gained after the first v1 documents were written, with the value a missing
 * one means. Filled before validation, so a strict reader still opens every file Aster has saved:
 * `isOrdered`, `isUnique`, `isID` on attributes and ends (2026-10-18), `index` on `#source`
 * records, and any display flag a diagram's defaults lack.
 */
function fill(json: unknown): unknown {
	if (typeof json !== 'object' || json === null) return json;
	const p = (json as { project?: Record<string, unknown> }).project;
	if (!p || typeof p !== 'object') return json;
	const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
	const def = (o: Record<string, unknown>, k: string, v: unknown) => {
		if (o[k] === undefined) o[k] = v;
	};
	if (obj(p.elements))
		for (const el of Object.values(p.elements)) {
			if (!obj(el)) continue;
			if (el.kind === 'classifier' && Array.isArray(el.attributes))
				for (const a of el.attributes)
					if (obj(a)) {
						def(a, 'isOrdered', false);
						def(a, 'isUnique', false);
						def(a, 'isID', false);
					}
			if (el.kind === 'relationship')
				for (const e of [el.sourceEnd, el.targetEnd])
					if (obj(e)) {
						def(e, 'isOrdered', false);
						def(e, 'isUnique', false);
					}
		}
	if (Array.isArray(p.unknown)) p.unknown.forEach((u, i) => obj(u) && def(u, 'index', i));
	if (Array.isArray(p.diagrams))
		for (const d of p.diagrams)
			if (obj(d) && obj(d.defaults))
				for (const [k, v] of Object.entries(DEFAULT_DISPLAY_FLAGS)) def(d.defaults, k, v);
	return json;
}

/** Older documents to the current shape. v1 is the first version; the switch is where v2 goes. */
export function migrate(json: unknown): unknown {
	const version =
		typeof json === 'object' && json !== null ? (json as { version?: unknown }).version : undefined;
	switch (version) {
		case ASTER_VERSION:
			return fill(json);
		default:
			throw new AsterError(
				typeof version === 'number' && version > ASTER_VERSION
					? `written by a newer Aster (version ${version}); this one reads version ${ASTER_VERSION}`
					: `expected version ${ASTER_VERSION}`,
				'$.version'
			);
	}
}

/** A document (object or text) back to a Project. Throws `AsterError` with a JSON path. */
export function parseAster(input: unknown): { project: Project; origin?: AsterOrigin } {
	let json = input;
	if (typeof input === 'string') {
		try {
			json = JSON.parse(input.charCodeAt(0) === 0xfeff ? input.slice(1) : input);
		} catch {
			throw new AsterError('not valid JSON', '$');
		}
	}
	const file = validateAsterFile(migrate(json), '$');
	const p = file.project;
	const project: Project = {
		id: p.id,
		name: p.name,
		elements: new Map(Object.entries(p.elements)),
		diagrams: p.diagrams.map((d): Diagram => ({
			...d,
			layout: new Map(Object.entries(d.layout) as [string, Layout][])
		})),
		unknown: p.unknown,
		importedIds: new Set(p.importedIds)
	};
	return { project, ...(file.origin && { origin: file.origin }) };
}

/**
 * What an `.mdj` save would keep only in the Aster copy. `serializeMdj` is lossless for everything
 * `types.ts` models plus `unknown`, so v1 reports nothing; the hook exists for the save flow's banner.
 */
export function lossReport(project: Project): string[] {
	void project;
	return [];
}

/** sha-256 of file bytes, hex; the `origin.sourceHash` of an mdj-born project. */
export async function hashBytes(data: ArrayBuffer | Uint8Array | string): Promise<string> {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
