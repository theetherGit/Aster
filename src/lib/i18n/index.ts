import { en } from './en.ts';

export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;

// ponytail: single locale, plain lookup with {name} interpolation; swap for a loader when a second language ships
export function t(key: MessageKey, params?: MessageParams): string {
	let s: string = en[key];
	if (params) {
		for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
	}
	return s;
}
