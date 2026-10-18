<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { Toolbar } from 'bits-ui';
	import { COMMANDS } from '#lib/app/commands.svelte.ts';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Board 03: a 36 px row of icon buttons; each runs a registry command.
	const run = (id: string) => COMMANDS.find((c) => c.id === id)?.run();
	const { setZoom } = useSvelteFlow();
	const percent = $derived(Math.round(ui.zoom * 100));

	const ICONS: { id: string; label: string; d: string }[] = [
		{
			id: 'file.new',
			label: t('file.new'),
			d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6'
		},
		{
			id: 'file.open',
			label: t('file.open'),
			d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
		},
		{ id: 'file.save', label: t('file.save'), d: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7' }
	];
	const undoD = 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3';
	const redoD = 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3';
</script>

<Toolbar.Root aria-label={t('classic.toolbar')} class="classic-toolbar">
	{#each ICONS as b (b.id)}
		<Toolbar.Button class="tb" aria-label={b.label} title={b.label} onclick={() => run(b.id)}>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d={b.d} /></svg
			>
		</Toolbar.Button>
	{/each}
	<span class="sep" aria-hidden="true"></span>
	<Toolbar.Button
		class="tb"
		aria-label={t('ui.undo')}
		title={t('ui.undo')}
		disabled={!projectStore.canUndo}
		onclick={() => projectStore.undo()}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"><path d={undoD} /></svg
		>
	</Toolbar.Button>
	<Toolbar.Button
		class="tb"
		aria-label={t('ui.redo')}
		title={t('ui.redo')}
		disabled={!projectStore.canRedo}
		onclick={() => projectStore.redo()}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"><path d={redoD} /></svg
		>
	</Toolbar.Button>
	<span class="sep" aria-hidden="true"></span>
	<Toolbar.Button
		class="tb text"
		aria-label={t('ui.zoomReset')}
		title={t('ui.zoomReset')}
		onclick={() => setZoom(1)}
	>
		{t('ui.zoomLevel', { percent })}
	</Toolbar.Button>
	<Toolbar.Button class="tb text" onclick={() => canvasApi.fitAll()}
		>{t('classic.fit')}</Toolbar.Button
	>
	<span class="flex-1"></span>
	<Toolbar.Button class="tb text" onclick={() => (ui.exportOpen = true)}
		>{t('classic.export')}</Toolbar.Button
	>
	<Toolbar.Button
		class="tb text"
		onclick={() => (ui.layoutPreset = 'modern')}
		title={t('classic.switchToModern')}
	>
		{t('classic.layoutButton')}
	</Toolbar.Button>
</Toolbar.Root>

<style>
	:global(.classic-toolbar) {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 36px;
		padding: 0 8px;
		background: var(--chrome-bg);
		border-bottom: 1px solid var(--chrome-border);
	}
	:global(.classic-toolbar .tb) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		font-size: 12px;
		color: var(--chrome-text);
		border: 1px solid transparent;
		border-radius: 3px;
	}
	:global(.classic-toolbar .tb.text) {
		width: auto;
		height: 26px;
		padding: 0 8px;
		background: var(--chrome-surface);
		border-color: var(--chrome-border);
	}
	:global(.classic-toolbar .tb:hover:not(:disabled)) {
		border-color: var(--chrome-border);
	}
	:global(.classic-toolbar .tb:disabled) {
		color: var(--chrome-muted);
		opacity: 0.6;
	}
	.sep {
		width: 1px;
		height: 20px;
		margin: 0 4px;
		background: var(--chrome-border);
	}
</style>
