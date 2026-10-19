<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Tip from '../Tip.svelte';

	// Board 03: a 36 px row of icon buttons; each runs a registry command (CLAUDE rule 1).
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : undefined;
	};
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
	// Undo and redo stay focusable while empty so the tooltip can say why they do nothing.
	const undoTip = $derived(
		projectStore.canUndo
			? projectStore.undoLabel
				? t('ui.undoNamed', { label: projectStore.undoLabel })
				: t('ui.undo')
			: t('ui.nothingToUndo')
	);
	const redoTip = $derived(
		projectStore.canRedo
			? projectStore.redoLabel
				? t('ui.redoNamed', { label: projectStore.redoLabel })
				: t('ui.redo')
			: t('ui.nothingToRedo')
	);
	// aria-description is not in Svelte's attribute typings yet, so it goes in through a spread.
	const describe = (text: string | undefined): Record<string, string | undefined> => ({
		'aria-description': text
	});
</script>

<Toolbar.Root aria-label={t('classic.toolbar')} class="classic-toolbar">
	{#each ICONS as b (b.id)}
		<Tip text={b.label} key={key(b.id)}>
			{#snippet children({ props })}
				<Toolbar.Button {...props} class="tb" aria-label={b.label} onclick={() => runCommand(b.id)}>
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
			{/snippet}
		</Tip>
	{/each}
	<span class="sep" aria-hidden="true"></span>
	<Tip text={undoTip} key={key('edit.undo')}>
		{#snippet children({ props })}
			<Toolbar.Button
				{...props}
				class="tb"
				aria-label={t('ui.undo')}
				aria-disabled={projectStore.canUndo ? undefined : true}
				{...describe(projectStore.canUndo ? undefined : t('ui.nothingToUndo'))}
				onclick={() => runCommand('edit.undo')}
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
		{/snippet}
	</Tip>
	<Tip text={redoTip} key={key('edit.redo')}>
		{#snippet children({ props })}
			<Toolbar.Button
				{...props}
				class="tb"
				aria-label={t('ui.redo')}
				aria-disabled={projectStore.canRedo ? undefined : true}
				{...describe(projectStore.canRedo ? undefined : t('ui.nothingToRedo'))}
				onclick={() => runCommand('edit.redo')}
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
		{/snippet}
	</Tip>
	<span class="sep" aria-hidden="true"></span>
	<Tip text={t('ui.zoomReset')} key={key('zoom.reset')}>
		{#snippet children({ props })}
			<Toolbar.Button {...props} class="tb text" onclick={() => runCommand('zoom.reset')}>
				{t('ui.zoomLevel', { percent })}
			</Toolbar.Button>
		{/snippet}
	</Tip>
	<Tip text={t('cmd.zoomFit')} key={key('zoom.fit')}>
		{#snippet children({ props })}
			<Toolbar.Button {...props} class="tb text" onclick={() => runCommand('zoom.fit')}
				>{t('classic.fit')}</Toolbar.Button
			>
		{/snippet}
	</Tip>
	<span class="flex-1"></span>
	<Tip text={t('export.title')} key={key('file.export')}>
		{#snippet children({ props })}
			<Toolbar.Button {...props} class="tb text" onclick={() => runCommand('file.export')}
				>{t('classic.export')}</Toolbar.Button
			>
		{/snippet}
	</Tip>
	<Tip text={t('cmd.layoutModern')} key={key('view.layout')}>
		{#snippet children({ props })}
			<Toolbar.Button {...props} class="tb text" onclick={() => runCommand('view.layout')}>
				{t('classic.layoutButton')}
			</Toolbar.Button>
		{/snippet}
	</Tip>
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
		border-color: var(--control-border);
	}
	:global(.classic-toolbar .tb:hover:not([aria-disabled])) {
		border-color: var(--control-border);
	}
	:global(.classic-toolbar .tb[aria-disabled]) {
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
