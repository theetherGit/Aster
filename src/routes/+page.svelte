<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import Canvas from '#lib/canvas/Canvas.svelte';
	import { handleGlobalKey } from '#lib/canvas/keyboard.ts';
	import { t } from '#lib/i18n/index.ts';
	import Explorer from '#lib/panels/Explorer.svelte';
	import Inspector from '#lib/panels/Inspector.svelte';
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

<svelte:window onkeydown={handleGlobalKey} />

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
			</div>
			{#if selection.size}
				<Inspector />
			{/if}
		</Tabs.Content>
	</Tabs.Root>
	<RelationshipPicker />
</SvelteFlowProvider>
