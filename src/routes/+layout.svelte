<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import paperFont from '#lib/assets/fonts/source-sans-3/source-sans-3-latin-wght-normal.woff2';
	import { isRtl, locale, startLocale } from '#lib/i18n/locale.svelte.ts';
	import { live } from '#lib/stores/live.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import { OG_IMAGE } from '#lib/seo.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { Tooltip } from 'bits-ui';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The page is prerendered in English; the locale is applied once the app is live.
	$effect(() => {
		startLocale(new URL(location.href));
	});
	// RTL-safe (features.md M2): the chrome mirrors; the paper keeps UML's coordinates (Canvas).
	$effect(() => {
		document.documentElement.dir = isRtl(locale.current) ? 'rtl' : 'ltr';
		document.documentElement.lang = locale.current === 'en' ? 'en' : 'en-XA';
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
	<!-- The card every shared link shows (static/og.png); pages add their own title and description. -->
	<meta property="og:site_name" content={t('app.name')} />
	<meta property="og:image" content={OG_IMAGE.url} />
	<meta property="og:image:width" content={String(OG_IMAGE.width)} />
	<meta property="og:image:height" content={String(OG_IMAGE.height)} />
	<meta property="og:image:alt" content={t('seo.imageAlt')} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={OG_IMAGE.url} />
	<!-- The browser chrome takes the app's background (tokens.css --chrome-bg; meta tags take no variables). -->
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f6f8" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1a1f" />
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
