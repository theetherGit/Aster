export type Locale = 'en' | 'pseudo';

/** Active locale. Reactive, so every `t()` in a template re-renders when it changes. */
export const locale: { current: Locale } = $state({ current: 'en' });

/** `?locale=pseudo` switches to the pseudo-locale for layout testing. */
export function localeFromUrl(url: URL): Locale {
	return url.searchParams.get('locale') === 'pseudo' ? 'pseudo' : 'en';
}
