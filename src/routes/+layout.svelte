<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import paperFont from '#lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-normal.woff2';
	import { locale, localeFromUrl } from '#lib/i18n/locale.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The page is prerendered in English; the locale is applied once the app is live.
	$effect(() => {
		locale.current = localeFromUrl(new URL(location.href));
	});

	// Theme: the remembered override, else the system; written to <html data-theme> so the
	// token blocks in layout.css apply. The paper stays white either way (ui.md).
	$effect(() => {
		const media = matchMedia('(prefers-color-scheme: dark)');
		const apply = () => {
			const resolved = ui.theme === 'system' ? (media.matches ? 'dark' : 'light') : ui.theme;
			document.documentElement.dataset.theme = resolved;
		};
		apply();
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={paperFont} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
