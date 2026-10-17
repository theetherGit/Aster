import en from './en.json';
import { locale } from './locale.svelte.ts';

export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;

/**
 * Pseudo-locale for layout testing: wraps a message in brackets and lengthens it by 30 %.
 * Runs before interpolation, so placeholders survive and user data is not padded.
 */
export function pseudolocalise(s: string): string {
	return `[${s}${'~'.repeat(Math.ceil(s.length * 0.3))}]`;
}

// ponytail: one real locale, plain lookup; swap for a message-file loader when a second language ships
export function t(key: MessageKey, params?: MessageParams): string {
	let s: string = en[key];
	if (locale.current === 'pseudo') s = pseudolocalise(s);
	if (params) {
		for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
	}
	return s;
}
