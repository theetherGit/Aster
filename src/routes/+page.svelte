<script lang="ts">
	import { SITE, jsonLdTag } from '#lib/seo.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.ts';
	import ImportNotice from '#lib/panels/ImportNotice.svelte';
	import Welcome from '#lib/panels/Welcome.svelte';
	import { persist } from '#lib/persist/autosave.svelte.ts';
	import { files, openDropped } from '#lib/persist/files.svelte.ts';

	// Boards 07 and 23: the welcome stands alone at `/`. Every action ends in the editor.
	async function drop(list: FileList) {
		await openDropped(list);
		if (files.current && persist.route)
			await goto(resolve('/design/[slug]', { slug: persist.route }));
	}
</script>

<svelte:head>
	<title>{t('seo.title')}</title>
	<meta name="description" content={t('seo.description')} />
	<link rel="canonical" href="{SITE}/" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={t('seo.headline')} />
	<meta property="og:description" content={t('seo.description')} />
	<meta property="og:url" content="{SITE}/" />
	<meta name="twitter:title" content={t('seo.headline')} />
	<meta name="twitter:description" content={t('seo.description')} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- our own constants, `<` escaped (seo.ts) -->
	{@html jsonLdTag(t('seo.description'))}
</svelte:head>

<svelte:window
	ondragover={(e) => {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		files.dragging = true;
	}}
	ondragleave={(e) => {
		if (!e.relatedTarget) files.dragging = false;
	}}
	ondrop={(e) => {
		if (!e.dataTransfer?.files.length) return;
		e.preventDefault();
		drop(e.dataTransfer.files);
	}}
/>

<Welcome />
<ImportNotice />
