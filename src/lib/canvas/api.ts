/** What the canvas offers to commands that run outside it (palette, keyboard); set while mounted. */
import type { ClassifierKind, Id } from '#lib/model/types.ts';

export interface CanvasApi {
	create: (kind: ClassifierKind) => void;
	createNote: () => void;
	createText: () => void;
	startLink: () => boolean;
	zoomBy: (factor: number) => void;
	zoomTo: (zoom: number) => void;
	fitAll: () => void;
	fitSelection: () => void;
	/** Rendered rectangles of the nodes, see focus.ts. */
	rects: () => Map<Id, { x: number; y: number; w: number; h: number }>;
}

const noop = () => {};
export const canvasApi: CanvasApi = {
	create: noop,
	createNote: noop,
	createText: noop,
	startLink: () => false,
	zoomBy: noop,
	zoomTo: noop,
	fitAll: noop,
	fitSelection: noop,
	rects: () => new Map()
};
