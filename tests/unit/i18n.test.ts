import { afterEach, describe, expect, it } from 'vitest';
import { pseudolocalise, t } from '#lib/i18n/index.ts';
import en from '#lib/i18n/en.json';
import { locale, localeFromUrl } from '#lib/i18n/locale.svelte.ts';
import { format, parse } from '#lib/app/shortcuts.ts';

afterEach(() => {
	locale.current = 'en';
});

describe('i18n', () => {
	it('resolves every key in the English catalogue to a non-empty string', () => {
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			expect(t(key)).not.toBe('');
		}
	});

	it('interpolates placeholders', () => {
		expect(t('cmd.deleteFromModel', { name: 'Book' })).toBe('delete Book');
	});

	it('pseudo-locale brackets every message and lengthens it by at least 30 %', () => {
		locale.current = 'pseudo';
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			const source = en[key];
			const out = t(key);
			expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
			expect(out.length).toBeGreaterThanOrEqual(Math.ceil(source.length * 1.3));
		}
		expect(t('cmd.deleteFromModel', { name: 'Book' })).toMatch(/^\[delete Book~+\]$/);
		expect(pseudolocalise('{n}')).toBe('[{n}~]');
	});

	it('reads the locale from the URL', () => {
		expect(localeFromUrl(new URL('https://x.test/?locale=pseudo'))).toBe('pseudo');
		expect(localeFromUrl(new URL('https://x.test/?locale=fr'))).toBe('en');
		expect(localeFromUrl(new URL('https://x.test/'))).toBe('en');
	});
});

describe('keys in copy come from the platform formatter', () => {
	it('formats ⌘ as Ctrl off macOS', () => {
		expect(format(parse('⌘N'), false)).toBe('Ctrl+N');
		expect(format(parse('⌘⇧E'), false)).toBe('Ctrl+Shift+E');
		expect(format(parse('⌘N'), true)).toBe('⌘N');
	});

	it('the welcome, project menu, top bar, export sheet and Classic chrome embed no ⌘', () => {
		// `file.openShortcut` and `welcome.sampleStrip` belong to the empty hint and the sample strip.
		const prefixes = ['welcome.', 'ui.', 'export.', 'classic.'];
		const exact = ['file.new', 'file.open', 'file.save', 'file.saveAs'];
		const offenders = (Object.keys(en) as (keyof typeof en)[]).filter(
			(k) =>
				(prefixes.some((p) => k.startsWith(p)) || exact.includes(k)) &&
				k !== 'welcome.sampleStrip' &&
				en[k].includes('⌘')
		);
		expect(offenders).toEqual([]);
	});
});
