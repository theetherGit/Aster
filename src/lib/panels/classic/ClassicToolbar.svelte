<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Icon, { type IconName } from '#lib/ui/atoms/Icon.svelte';
	import Separator from '#lib/ui/atoms/Separator.svelte';
	import Tip from '#lib/ui/atoms/Tooltip.svelte';

	// Board 03: a 36 px row of icon buttons; each runs a registry command (CLAUDE rule 1).
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : undefined;
	};
	const percent = $derived(Math.round(ui.zoom * 100));

	const ICONS: { id: string; label: string; icon: IconName }[] = [
		{ id: 'file.new', label: t('file.new'), icon: 'file-plus' },
		{ id: 'file.open', label: t('file.open'), icon: 'folder-open' },
		{ id: 'file.save', label: t('file.save'), icon: 'save' }
	];
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

{#snippet sep()}
	<span class="mx-1 flex h-5" aria-hidden="true"><Separator orientation="vertical" /></span>
{/snippet}

<!-- Toolbar.Button owns the element (roving focus), so the buttons keep their dress by class. -->
<Toolbar.Root aria-label={t('classic.toolbar')} class="classic-toolbar">
	{#each ICONS as b (b.id)}
		<Tip text={b.label} key={key(b.id)}>
			{#snippet children({ props })}
				<Toolbar.Button {...props} class="tb" aria-label={b.label} onclick={() => runCommand(b.id)}>
					<Icon name={b.icon} />
				</Toolbar.Button>
			{/snippet}
		</Tip>
	{/each}
	{@render sep()}
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
				<Icon name="undo" />
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
				<Icon name="redo" />
			</Toolbar.Button>
		{/snippet}
	</Tip>
	{@render sep()}
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
		gap: var(--space-1);
		height: 36px; /* board 03: the one bar height the token scale does not name */
		padding: 0 var(--space-2);
		background: var(--chrome-bg);
		border-bottom: 1px solid var(--chrome-border);
	}
	:global(.classic-toolbar .tb) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-icon);
		height: var(--control-icon);
		font-size: var(--text-small);
		color: var(--chrome-text);
		border: 1px solid transparent;
		border-radius: var(--control-radius);
	}
	:global(.classic-toolbar .tb.text) {
		width: auto;
		padding: 0 var(--space-2);
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
</style>
