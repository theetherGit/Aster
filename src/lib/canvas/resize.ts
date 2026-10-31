import { PACKAGE_MIN, resizeNode, setNodeFlags } from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import type { SerialisedCommand } from '#lib/commands/types.ts';
import { getDiagram, getNodeLayout } from '#lib/model/project.ts';
import type { Element, Id, Project } from '#lib/model/types.ts';
import { ui } from '#lib/stores/ui.svelte.ts';

export interface Size {
	w: number;
	h: number;
}

/** The least a box of each kind takes (ui.md): a class 160 wide, an object 120, a note 120 × 60. */
export function leastSize(kind: Element['kind'] | undefined): Size {
	if (kind === 'package') return PACKAGE_MIN;
	if (kind === 'classifier') return { w: 160, h: 40 };
	if (kind === 'instance') return { w: 120, h: 40 };
	if (kind === 'text') return { w: 120, h: 24 };
	return { w: 120, h: 60 };
}

/**
 * The commands that give one box a new size, clamped to its kind's least. A class or an object
 * keeps a height only while its view's autoResize is off (StarUML's rule, flow.svelte.ts), so
 * giving one a height turns that off too; content still wins over a size smaller than it. A
 * width alone leaves the height, and the flag, as they are.
 */
export function resizeView(
	p: Project,
	diagramId: Id,
	id: Id,
	size: { w: number; h?: number }
): SerialisedCommand[] {
	const d = getDiagram(p, diagramId);
	const l = getNodeLayout(d, id);
	const kind = p.elements.get(id)?.kind;
	const min = leastSize(kind);
	const w = Math.max(min.w, Math.round(size.w));
	const h = size.h === undefined ? l.h : Math.max(min.h, Math.round(size.h));
	if (w === l.w && h === l.h) return [];
	const out = [serialise(resizeNode(p, { diagramId, id, w, h }))];
	const sized = kind === 'classifier' || kind === 'instance';
	if (size.h !== undefined && sized && { ...d.defaults, ...l.flags }.autoResize !== false)
		out.push(serialise(setNodeFlags(p, { diagramId, id, patch: { autoResize: false } })));
	return out;
}

/**
 * A corner handle's drag: the size follows the pointer (screen pixels over the zoom, never under
 * `min`), `onmove` drawing it live and `onend` getting the last size, or null when nothing moved.
 * ⇧+arrows and the inspector's Size are the non-drag paths (accessibility.md).
 */
export function dragSize(
	e: PointerEvent,
	from: Size,
	min: Size,
	onmove: (s: Size) => void,
	onend: (s: Size | null) => void
) {
	if (e.button !== 0) return;
	e.preventDefault();
	e.stopPropagation();
	const handle = e.currentTarget as HTMLElement;
	handle.setPointerCapture(e.pointerId);
	const x = e.clientX;
	const y = e.clientY;
	let last: Size | null = null;
	const move = (ev: PointerEvent) => {
		const z = ui.zoom || 1;
		last = {
			w: Math.max(min.w, Math.round(from.w + (ev.clientX - x) / z)),
			h: Math.max(min.h, Math.round(from.h + (ev.clientY - y) / z))
		};
		onmove(last);
	};
	const up = () => {
		handle.removeEventListener('pointermove', move);
		handle.removeEventListener('pointerup', up);
		onend(last);
	};
	handle.addEventListener('pointermove', move);
	handle.addEventListener('pointerup', up);
}
