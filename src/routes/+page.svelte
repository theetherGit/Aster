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

	const counts = $derived.by(() => {
		const d = projectStore.diagram;
		const kind = (k: string) =>
			d.elementIds.filter((id) => projectStore.project.elements.get(id)?.kind === k).length;
		return { classifiers: kind('classifier'), relationships: kind('relationship') };
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
				<footer class="footer" aria-label={t('footer.counts', counts)}>
					{t('footer.counts', counts)}
				</footer>
			</div>
			{#if selection.size}
				<Inspector />
			{/if}
		</Tabs.Content>
	</Tabs.Root>
	<RelationshipPicker />
	{#if files.dragging}
		<!-- Board 21: the whole window is the drop target. -->
		<div class="drop-overlay">
			<div class="drop-card" role="status">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path
						d="M12 11v6M9 14l3 3 3-3"
					/></svg
				>
				<p class="drop-title">{t('file.dropTitle')}</p>
				<p class="drop-hint">{t('file.dropHint')}</p>
			</div>
		</div>
	{/if}
</SvelteFlowProvider>

<style>
	.footer {
		position: absolute;
		bottom: 18px;
		left: 22px;
		z-index: 5;
		font-size: 12px;
		color: var(--chrome-muted);
		pointer-events: none;
	}
	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		pointer-events: none;
	}
	.drop-overlay::after {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2px dashed var(--accent);
		border-radius: 10px;
	}
	.drop-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 22px 40px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 12px;
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.22);
	}
	.drop-card svg {
		box-sizing: content-box;
		padding: 8px;
		color: var(--on-accent);
		background: var(--accent);
		border-radius: 8px;
	}
	.drop-title {
		font-size: 15px;
		font-weight: 600;
	}
	.drop-hint {
		font-size: 12px;
		color: var(--chrome-muted);
	}
</style>
