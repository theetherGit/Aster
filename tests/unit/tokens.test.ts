import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/tokens.ts';

/** tokens.json is generated from tokens.css (`pnpm tokens`); the two must agree. */
describe('design tokens', () => {
	const generated = build() as { aster: Record<string, Record<string, { $value: string }>> };
	it('tokens.json matches tokens.css', () => {
		const stored = JSON.parse(
			readFileSync(new URL('../../src/lib/ui/tokens.json', import.meta.url), 'utf8')
		);
		expect(stored).toEqual(generated);
	});
	it('every theme defines the chrome set and the scales name the control metrics', () => {
		for (const theme of ['light', 'dark', 'high-contrast', 'classic']) {
			for (const k of ['chrome-bg', 'chrome-text', 'accent', 'accent-text', 'danger'])
				expect(generated.aster[theme][k], `${theme} ${k}`).toBeDefined();
		}
		expect(generated.aster.scales['control-min'].$value).toBe('24px');
		expect(generated.aster.scales['dur-short'].$value).toBe('160ms');
	});
});
