/** UML 2.5 notation rules for an edge: which markers, which dash, which labels. */
import type { DisplayFlags, End, LabelKey, Relationship, Visibility } from '#lib/model/types.ts';

export type MarkerId = 'triangle' | 'arrow' | 'diamond-hollow' | 'diamond-filled';
export interface Notation {
	/** Marker at the source end (path start) and at the target end (path end). */
	start: MarkerId | null;
	end: MarkerId | null;
	dashed: boolean;
	/** Ends that touch the classifier typing an owned end: the ownership dot goes there. */
	dots: ('source' | 'target')[];
}

/** Marker lengths along the line, in paper units (ui.md). */
export const MARKER_LENGTH: Record<MarkerId, number> = {
	triangle: 14,
	arrow: 12,
	'diamond-hollow': 14,
	'diamond-filled': 14
};

const navigable = (e: End | undefined) => e?.navigable === 'navigable';

export function markersFor(r: Relationship): Notation {
	switch (r.relationshipKind) {
		case 'generalization':
			return { start: null, end: 'triangle', dashed: false, dots: [] };
		case 'realization':
			return { start: null, end: 'triangle', dashed: true, dots: [] };
		case 'dependency':
			return { start: null, end: 'arrow', dashed: true, dots: [] };
	}
	// Association family: an arrow at a navigable end only when the other end is not navigable.
	const s = r.sourceEnd;
	const t = r.targetEnd;
	const arrowAtSource = navigable(s) && !navigable(t);
	const arrowAtTarget = navigable(t) && !navigable(s);
	const diamond =
		r.relationshipKind === 'aggregation'
			? 'diamond-hollow'
			: r.relationshipKind === 'composition'
				? 'diamond-filled'
				: null;
	const dots: Notation['dots'] = [];
	if (s?.ownsOther) dots.push('target');
	if (t?.ownsOther) dots.push('source');
	return {
		start: arrowAtSource ? 'arrow' : null,
		end: diamond ?? (arrowAtTarget ? 'arrow' : null),
		dashed: false,
		dots
	};
}

export interface EdgeLabelSpec {
	key: LabelKey;
	at: 'source' | 'target' | 'mid';
	lines: string[];
}

const SYMBOL: Record<Visibility, string> = {
	public: '+',
	protected: '#',
	private: '-',
	package: '~'
};

/** Name (with «stereotype» above it) at the middle; role and multiplicity at each association end. */
export function labelsFor(r: Relationship, flags: DisplayFlags): EdgeLabelSpec[] {
	const out: EdgeLabelSpec[] = [];
	const mid = [...(r.stereotype ? [`«${r.stereotype}»`] : []), ...(r.name ? [r.name] : [])];
	if (mid.length) out.push({ key: 'name', at: 'mid', lines: mid });
	for (const [at, e] of [
		['source', r.sourceEnd],
		['target', r.targetEnd]
	] as const) {
		if (!e) continue;
		if (e.role) {
			const vis = flags.showVisibility && e.visibility ? SYMBOL[e.visibility] : '';
			out.push({ key: `${at}Role`, at, lines: [`${vis}${e.isDerived ? '/' : ''}${e.role}`] });
		}
		if (flags.showMultiplicity && e.multiplicity)
			out.push({ key: `${at}Multiplicity`, at, lines: [e.multiplicity] });
	}
	return out;
}
