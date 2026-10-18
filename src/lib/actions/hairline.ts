/**
 * `use:hairline={{ figure, … }}`: mounts a Hairline figure (https://hairline.lucasmarkes.com,
 * vanilla API) in the node, forwards changed options to `update`, destroys it on unmount.
 * Chrome only: never on the canvas, where pointer events select and drag (DECISIONS.md).
 * Actions run on mount in the browser, so a prerendered page never touches `document`.
 */
import type { Figure, HairlineOptions as Options } from '@lucasmarkes/hairline';
import type { Action } from 'svelte/action';

export type FigureFn = (el: HTMLElement, options?: Options) => Figure;

export interface HairlineOptions extends Options {
	figure: FigureFn;
}

const OPTION_KEYS = ['intensity', 'theme', 'label', 'onRead', 'play'] as const;
const pick = (o: HairlineOptions): Options => {
	const out: Options = {};
	for (const k of OPTION_KEYS) if (o[k] !== undefined) (out as Record<string, unknown>)[k] = o[k];
	return out;
};

export const hairline: Action<HTMLElement, HairlineOptions> = (node, params) => {
	let current = params;
	let figure: Figure = params.figure(node, pick(params));
	return {
		update(next) {
			if (next.figure !== current.figure) {
				figure.destroy();
				figure = next.figure(node, pick(next));
			} else {
				// Only what changed; a key gone back to undefined resets to the figure's default.
				const patch: Record<string, unknown> = {};
				for (const k of OPTION_KEYS) if (next[k] !== current[k]) patch[k] = next[k];
				if (Object.keys(patch).length) figure.update(patch as Options);
			}
			current = next;
		},
		destroy() {
			figure.destroy();
		}
	};
};
