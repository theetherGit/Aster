<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import paperFont from '#lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-normal.woff2';
	import { locale, localeFromUrl } from '#lib/i18n/locale.svelte.ts';
	import { live } from '#lib/stores/live.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { Tooltip } from 'bits-ui';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The page is prerendered in English; the locale is applied once the app is live.
	$effect(() => {
		locale.current = localeFromUrl(new URL(location.href));
	});

	// Theme: the remembered override, else the system; written to <html data-theme> so the
	// token blocks in layout.css apply. The paper stays white either way (ui.md).
	const prefersDark = new MediaQuery('(prefers-color-scheme: dark)');
	$effect(() => {
		document.documentElement.dataset.theme =
			ui.theme === 'system' ? (prefersDark.current ? 'dark' : 'light') : ui.theme;
	});
	// The layout preset's tokens (ui.md): Classic is grey chrome and yellow classes in every theme.
	$effect(() => {
		document.documentElement.dataset.layout = ui.layoutPreset;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={paperFont} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<!-- One tooltip provider for every Tip: 600 ms on hover, none on focus, none between neighbours. -->
<Tooltip.Provider delayDuration={600} skipDelayDuration={300}>
	{@render children()}
</Tooltip.Provider>

<!-- accessibility.md, Announcements: one polite and one assertive region, mounted once. -->
<div class="sr-only" aria-live="polite" data-testid="live">{live.text}</div>
<div class="sr-only" aria-live="assertive" role="alert" data-testid="live-alert">
	{live.alertText}
</div>
