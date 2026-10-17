<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import Canvas from '#lib/canvas/Canvas.svelte';
	import { handleGlobalKey } from '#lib/canvas/keyboard.ts';
	import { t } from '#lib/i18n/index.ts';
	import Explorer from '#lib/panels/Explorer.svelte';
	import ImportNotice from '#lib/panels/ImportNotice.svelte';
	import Inspector from '#lib/panels/Inspector.svelte';
	import { files, openDropped } from '#lib/persist/files.svelte.ts';
	import RelationshipPicker from '#lib/panels/RelationshipPicker.svelte';
	import { notationProject } from '#lib/model/fixtures.ts';
	import Toolbox from '#lib/panels/Toolbox.svelte';
	import TopBar from '#lib/panels/TopBar.svelte';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// `?fixture=notation` opens the UML notation fixture (visual regression and manual review).
	onMount(() => {
		if (new URL(location.href).searchParams.get('fixture') === 'notation')
			projectStore.load(notationProject());
	});
</script>

<svelte:head>
	<title>{projectStore.project.name} – {t('app.name')}</title>
</svelte:head>

<svelte:window
	onkeydown={handleGlobalKey}
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
		openDropped(e.dataTransfer.files);
	}}
/>

<!-- Modern layout (docs/spec/ui.md, boards 01–02): top bar, floating toolbox, right inspector. -->
<SvelteFlowProvider>
	<Tabs.Root bind:value={projectStore.activeDiagramId} class="grid h-dvh grid-rows-[44px_1fr]">
		<TopBar />
		<Tabs.Content value={projectStore.activeDiagramId} class="relative flex min-h-0">
			{#if ui.panels.outline}
				<Explorer />
			{/if}
			<div class="relative min-w-0 flex-1">
				<Canvas />
				<Toolbox />
				<ImportNotice />
				{#if files.dragging}
					<div class="drop-overlay" aria-hidden="true">{t('file.drop')}</div>
				{/if}
			</div>
			{#if selection.size}
				<Inspector />
			{/if}
		</Tabs.Content>
	</Tabs.Root>
	<RelationshipPicker />
</SvelteFlowProvider>

<style>
	.drop-overlay {
		position: absolute;
		inset: 8px;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 15px;
		font-weight: 600;
		color: var(--chrome-text);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border: 2px dashed var(--accent);
		border-radius: 12px;
		pointer-events: none;
	}
</style>
