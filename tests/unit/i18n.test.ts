import { describe, it, expect } from 'vitest';
import { t } from '#lib/i18n/index.ts';
import { en } from '#lib/i18n/en.ts';

describe('i18n', () => {
	it('resolves every key in the English catalogue to a non-empty string', () => {
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			expect(t(key)).not.toBe('');
		}
	});
});
