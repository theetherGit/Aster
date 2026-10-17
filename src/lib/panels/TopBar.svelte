<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	const { zoomIn, zoomOut, getViewport, setViewport } = useSvelteFlow();
	const zoomReset = () => setViewport({ ...getViewport(), zoom: 1 });

	const undoTitle = $derived(
		projectStore.undoLabel ? t('ui.undoNamed', { label: projectStore.undoLabel }) : t('ui.undo')
	);
	const redoTitle = $derived(
		projectStore.redoLabel ? t('ui.redoNamed', { label: projectStore.redoLabel }) : t('ui.redo')
	);
</script>

<header class="flex h-11 items-center gap-3 border-b border-chrome-border bg-chrome-bg px-3">
	<button
		type="button"
		class="icon-btn"
		aria-label={t('explorer.toggle')}
		title={t('explorer.toggle')}
		aria-pressed={ui.panels.outline}
		onclick={() => (ui.panels.outline = !ui.panels.outline)}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"
			><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6 3v10" /></svg
		>
	</button>
	<h1 class="truncate font-semibold">{projectStore.project.name}</h1>

	<Tabs.List aria-label={t('ui.diagrams')} class="flex h-full items-end gap-1">
		{#each projectStore.project.diagrams as d (d.id)}
			<Tabs.Trigger
				value={d.id}
				class="h-8 min-w-6 rounded-t-control border border-b-0 border-transparent px-3 text-chrome-muted data-[state=active]:border-chrome-border data-[state=active]:bg-chrome-surface data-[state=active]:text-chrome-text"
			>
				{d.name}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class="icon-btn"
			aria-label={undoTitle}
			title={undoTitle}
			disabled={!projectStore.canUndo}
			onclick={() => projectStore.undo()}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
				><path d="M6 4 2.5 7.5 6 11" /><path d="M3 7.5h6.5a3 3 0 0 1 0 6H8" /></svg
			>
		</button>
		<button
			type="button"
			class="icon-btn"
			aria-label={redoTitle}
			title={redoTitle}
			disabled={!projectStore.canRedo}
			onclick={() => projectStore.redo()}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
				><path d="m10 4 3.5 3.5L10 11" /><path d="M13 7.5H6.5a3 3 0 0 0 0 6H8" /></svg
			>
		</button>

		<span class="mx-1 h-5 w-px bg-chrome-border" aria-hidden="true"></span>

		<button
			type="button"
			class="icon-btn"
			aria-label={t('ui.zoomOut')}
			title={t('ui.zoomOut')}
			onclick={() => zoomOut()}>−</button
		>
		<button
			type="button"
			class="icon-btn w-auto px-2 tabular-nums"
			aria-label={t('ui.zoomReset')}
			title={t('ui.zoomReset')}
			onclick={zoomReset}
		>
			{t('ui.zoomLevel', { percent: Math.round(ui.zoom * 100) })}
		</button>
		<button
			type="button"
			class="icon-btn"
			aria-label={t('ui.zoomIn')}
			title={t('ui.zoomIn')}
			onclick={() => zoomIn()}>+</button
		>

		<span class="mx-1 h-5 w-px bg-chrome-border" aria-hidden="true"></span>

		<button
			type="button"
			class="h-7 rounded-control bg-accent px-3 font-medium text-on-accent disabled:opacity-50"
			disabled
			title={t('ui.comingSoon')}
		>
			{t('ui.export')}
		</button>
		<button
			type="button"
			class="icon-btn"
			aria-label={t('ui.palette')}
			title={t('ui.comingSoon')}
			disabled
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
				><rect x="2" y="3" width="12" height="10" rx="1.5" /><path
					d="m5 7 2 1.5L5 10M8.5 10h3"
				/></svg
			>
		</button>
	</div>
</header>
