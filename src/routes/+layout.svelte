<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { locale, localeFromUrl } from '#lib/i18n/locale.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The page is prerendered in English; the locale is applied once the app is live.
	$effect(() => {
		locale.current = localeFromUrl(new URL(location.href));
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
