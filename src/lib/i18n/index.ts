import { en } from './en';

export type MessageKey = keyof typeof en;

// ponytail: single locale, plain lookup; swap for a loader when a second language ships
export function t(key: MessageKey): string {
	return en[key];
}
