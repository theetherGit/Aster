/**
 * Locales: English, and two pseudo-locales for layout testing (features.md M2, i18n
 * scaffolding): bracketed and 30 % longer, and the same right to left.
 */
export type Locale = 'en' | 'pseudo' | 'pseudo-rtl';
export const LOCALES: Locale[] = ['en', 'pseudo', 'pseudo-rtl'];

/** Active locale. Reactive, so every `t()` in a template re-renders when it changes. */
export const locale: { current: Locale } = $state({ current: 'en' });

const isLocale = (v: string | null): v is Locale => LOCALES.includes(v as Locale);

/** `?locale=pseudo` (or `en`, `pseudo-rtl`) in the address, when present. */
export function localeFromUrl(url: URL): Locale | null {
	const v = url.searchParams.get('locale');
	return isLocale(v) ? v : null;
}

const KEY = 'aster:locale';
/** The address wins, else the remembered choice, else English. */
export function startLocale(url: URL) {
	const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
	locale.current = localeFromUrl(url) ?? (isLocale(stored) ? stored : 'en');
}
/** The palette's language commands: switch and remember. */
export function setLocale(next: Locale) {
	locale.current = next;
	localStorage.setItem(KEY, next);
}
export const isRtl = (l: Locale) => l === 'pseudo-rtl';
