<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.ts';
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
	<title>{t('app.name')}</title>
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
