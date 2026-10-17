import type { Project } from '#lib/model/types.ts';

/** Order-independent structural view of model + layout, for equality assertions. */
export function structural(project: Project) {
	project = structuredClone(project);
	const sortById = <T extends [string, unknown]>(entries: Iterable<T>) =>
		[...entries].sort(([a], [b]) => a.localeCompare(b));
	return {
		id: project.id,
		name: project.name,
		elements: sortById(project.elements.entries()),
		diagrams: project.diagrams.map((d) => ({
			id: d.id,
			name: d.name,
			diagramKind: d.diagramKind,
			elementIds: [...d.elementIds],
			layout: sortById(d.layout.entries()),
			defaults: d.defaults
		})),
		importedIds: [...project.importedIds].sort()
	};
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		int: (n: number) => Math.floor(next() * n),
		pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)]
	};
}
