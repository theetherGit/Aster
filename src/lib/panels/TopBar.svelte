<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import ProjectMenu from './ProjectMenu.svelte';

	// useSvelteFlow() copies zoomIn/zoomOut from the store it sees first, which is the
	// provider's placeholder until the canvas mounts; setZoom/getZoom read the live store.
	const { getZoom, setZoom } = useSvelteFlow();
	const zoomBy = (factor: number) => setZoom(Math.min(4, Math.max(0.1, getZoom() * factor)));
	const zoomReset = () => setZoom(1);

	const undoTitle = $derived(
		projectStore.undoLabel ? t('ui.undoNamed', { label: projectStore.undoLabel }) : t('ui.undo')
	);
	const redoTitle = $derived(
		projectStore.redoLabel ? t('ui.redoNamed', { label: projectStore.redoLabel }) : t('ui.redo')
	);
</script>

<!-- Board 01: mark, project name, underline tabs; bordered controls on the right. -->
<header class="flex h-11 items-center gap-2 border-b border-chrome-border bg-chrome-bg pr-3 pl-4">
	<span class="mark" aria-hidden="true">
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
		>
			<path d="M7 1.5v11M2.2 4.25l9.6 5.5M2.2 9.75l9.6-5.5" />
		</svg>
	</span>
	<h1 class="m-0 min-w-0 text-[15px]"><ProjectMenu /></h1>

	<Tabs.List aria-label={t('ui.diagrams')} class="ml-3 flex h-full items-stretch">
		{#each projectStore.project.diagrams as d (d.id)}
			<Tabs.Trigger
				value={d.id}
				class="-mb-px border-b-2 border-transparent px-3 text-[13px] text-chrome-muted hover:text-chrome-text data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-chrome-text"
			>
				{d.name}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>

	<div class="ml-auto flex items-center gap-2">
		<div class="group-box">
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
		</div>

		<div class="group-box">
			<button
				type="button"
				class="icon-btn"
				aria-label={t('ui.zoomOut')}
				title={t('ui.zoomOut')}
				onclick={() => zoomBy(1 / 1.2)}>−</button
			>
			<button
				type="button"
				class="icon-btn w-auto px-1 text-[13px] tabular-nums"
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
				onclick={() => zoomBy(1.2)}>+</button
			>
		</div>

		<button
			type="button"
			class="group-box h-8 px-3 text-[13px] font-medium text-chrome-text hover:bg-chrome-surface disabled:opacity-50 disabled:hover:bg-transparent"
			disabled
			title={t('ui.comingSoon')}
		>
			{t('ui.export')}
		</button>
		<button
			type="button"
			class="group-box icon-btn disabled:hover:bg-transparent"
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
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m3.5 4.5 3.5 3.5-3.5 3.5M8.5 11.5h4" /></svg
			>
		</button>
	</div>
</header>

<style>
	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--on-accent);
		background: var(--accent);
		border-radius: 6px;
	}
	/* A bordered pill holding one or more 28 px controls. */
	.group-box {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: 32px;
		padding: 0 1px;
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-control);
	}
</style>
