/**
 * The `.aster` file (docs/file-format.md): the Project as JSON, nothing more. `Map` becomes an
 * object keyed by id in insertion order, `Set` an array, `undefined` fields are dropped.
 */
import type { Diagram, Id, Layout, Unknown } from '#lib/model/types.ts';
import type { Element } from '#lib/model/types.ts';

export const ASTER_SCHEMA = 'https://asteruml.app/schema/v1.json';
export const ASTER_VERSION = 1;

export interface AsterOrigin {
	kind: 'staruml';
	/** sha-256 (hex) of the .mdj bytes last read or written. */
	sourceHash: string;
	fileName?: string;
}

export interface AsterProject {
	id: Id;
	name: string;
	elements: Record<Id, Element>;
	diagrams: (Omit<Diagram, 'layout'> & { layout: Record<Id, Layout> })[];
	unknown: Unknown[];
	importedIds: Id[];
}

export interface AsterFile {
	$schema: typeof ASTER_SCHEMA;
	version: typeof ASTER_VERSION;
	meta?: { app: string; savedAt: string };
	origin?: AsterOrigin;
	project: AsterProject;
}
