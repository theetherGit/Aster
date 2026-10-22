/** What the canvas offers to commands that run outside it (palette, keyboard); set while mounted. */
import type { ClassifierKind, Id, Point } from '#lib/model/types.ts';

export interface CanvasApi {
	/** At a paper point, or at the cursor (the viewport centre when the pointer is elsewhere). */
	create: (kind: ClassifierKind, at?: Point) => void;
	createNote: () => void;
	/** An object on an object diagram (M3.2), at a paper point or the cursor. */
	createObject: (at?: Point) => void;
	createText: () => void;
	startLink: () => boolean;
	zoomBy: (factor: number) => void;
	zoomTo: (zoom: number) => void;
	fitAll: () => void;
	fitSelection: () => void;
	/** Pan so an element is in the middle of the view, zoom unchanged (quick find). */
	centreOn: (id: Id) => void;
	/** Rendered rectangles of the nodes, see focus.ts. */
	rects: () => Map<Id, { x: number; y: number; w: number; h: number }>;
}

const noop = () => {};
export const canvasApi: CanvasApi = {
	create: noop,
	createNote: noop,
	createObject: noop,
	createText: noop,
	startLink: () => false,
	zoomBy: noop,
	zoomTo: noop,
	fitAll: noop,
	fitSelection: noop,
	centreOn: noop,
	rects: () => new Map()
};
