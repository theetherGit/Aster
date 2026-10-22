/**
 * Project slugs for `/design/<slug>`. A slug is minted once a project has a name worth a URL: the
 * file it was opened from or saved to, or a project name that is not the untitled default. Drafts
 * have none and live under `/design/new`. Slugs are unique across the Recent list and never one
 * of the reserved route words.
 */
import { slug as stem } from '#lib/export/svg.ts';

/** Route words under `/design/` that are not projects. */
export const RESERVED = new Set(['new', 'sample', 'demo', 'notation']);

const EXT = /\.(aster\.json|aster|mdj)$/i;

/** "library.mdj" → "library"; a second "library" → "library-2"; "new" → "new-2". */
export function uniqueSlug(name: string, taken: Iterable<string | null | undefined>): string {
	const base = stem(name.replace(EXT, ''));
	const used = new Set<string>();
	for (const t of taken) if (t) used.add(t);
	let s = base;
	for (let n = 2; RESERVED.has(s) || used.has(s); n++) s = `${base}-${n}`;
	return s;
}
