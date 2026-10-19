<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { ContextMenu, Tabs } from 'bits-ui';
	import { tick } from 'svelte';
	import { renameDiagram } from '#lib/commands/index.ts';
	import { resolve } from '$app/paths';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import InlineName from '#lib/ui/molecules/InlineName.svelte';
	import ProjectMenu from './ProjectMenu.svelte';
	import Tip from '#lib/ui/atoms/Tooltip.svelte';
	import Button from '#lib/ui/atoms/Button.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import MenuItem from '#lib/ui/atoms/MenuItem.svelte';
	import Tab from '#lib/ui/atoms/Tab.svelte';

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
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : undefined;
	};
	// Tab rename (double-click, F2, context menu) runs the registry command on that diagram; when
	// the editor closes, focus goes back to the tab it came from.
	const rename = (id: string) => {
		projectStore.activeDiagramId = id;
		runCommand('diagram.rename');
	};
	const canDelete = $derived(projectStore.project.diagrams.length > 1);
	const deleteDiagram = (id: string) => {
		projectStore.activeDiagramId = id;
		runCommand('diagram.delete');
	};
	async function renamed(id: string) {
		ui.renaming = null;
		await tick();
		document.querySelector<HTMLElement>(`[role="tab"][data-value="${id}"]`)?.focus();
	}
	// aria-description is not in Svelte's attribute typings yet, so it goes in through a spread.
	const describe = (text: string | undefined): Record<string, string | undefined> => ({
		'aria-description': text
	});
</script>

<!-- Board 01: mark, project name, underline tabs; bordered controls on the right. -->
<header class="flex h-11 items-center gap-2 border-b border-chrome-border bg-chrome-bg pr-3 pl-4">
	<a href={resolve('/')} class="mark" aria-label={t('ui.home')}>
		<svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"
			><rect x="43" y="4" width="14" height="38" rx="7" /><rect
				x="43"
				y="4"
				width="14"
				height="38"
				rx="7"
				transform="rotate(60 50 50)"
			/><rect x="43" y="4" width="14" height="38" rx="7" transform="rotate(120 50 50)" /><rect
				x="43"
				y="4"
				width="14"
				height="38"
				rx="7"
				transform="rotate(180 50 50)"
			/><rect x="43" y="4" width="14" height="38" rx="7" transform="rotate(240 50 50)" /><rect
				x="43"
				y="4"
				width="14"
				height="38"
				rx="7"
				transform="rotate(300 50 50)"
			/><circle cx="50" cy="50" r="11" fill="var(--hairline-hi)" /></svg
		>
	</a>
	<h1 class="m-0 min-w-0 text-(length:--text-lead)"><ProjectMenu /></h1>

	<!-- Many tabs scroll sideways (no scrollbar chrome) rather than pushing the controls off the bar. -->
	<Tabs.List
		aria-label={t('ui.diagrams')}
		class="ml-3 flex h-full min-w-0 [scrollbar-width:none] items-stretch overflow-x-auto"
	>
		{#each projectStore.project.diagrams as d (d.id)}
			{#if ui.renaming === d.id}
				<InlineName
					value={d.name}
					label={t('ui.diagramName')}
					class="my-1.5 h-8 w-40 shrink-0 text-(length:--text-body)"
					oncommit={(name) => projectStore.run(renameDiagram, { diagramId: d.id, name })}
					ondone={() => renamed(d.id)}
				/>
			{:else}
				<!-- The tab and, on hover or focus within, its delete button (24 px, outside the tab button). -->
				<span class="group relative flex shrink-0 items-stretch" class:deletable={canDelete}>
					<ContextMenu.Root>
						<ContextMenu.Trigger>
							{#snippet child({ props })}
								<Tab
									{...props}
									value={d.id}
									ondblclick={() => rename(d.id)}
									onkeydown={(e: KeyboardEvent) => {
										if (e.key === 'F2') {
											e.preventDefault();
											rename(d.id);
										}
									}}
								>
									{d.name}
								</Tab>
							{/snippet}
						</ContextMenu.Trigger>
						<ContextMenu.Portal>
							<ContextMenu.Content class="menu">
								<MenuItem
									kind="context"
									icon="pencil"
									label={t('ui.renameDiagram')}
									onSelect={() => rename(d.id)}
								/>
								<MenuItem
									kind="context"
									icon="trash"
									label={t('ui.deleteDiagram')}
									disabled={!canDelete}
									onSelect={() => deleteDiagram(d.id)}
								/>
							</ContextMenu.Content>
						</ContextMenu.Portal>
					</ContextMenu.Root>
					{#if canDelete}
						<IconButton
							label={t('ui.deleteDiagramNamed', { name: d.name })}
							icon="x"
							size={24}
							iconSize={11}
							stroke={2.5}
							tip={false}
							class="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 group-has-[[aria-selected=true]]:pointer-events-auto group-has-[[aria-selected=true]]:opacity-100"
							onclick={() => deleteDiagram(d.id)}
						/>
					{/if}
				</span>
			{/if}
		{/each}
	</Tabs.List>
	<!-- Board 01: the "+" after the last tab; outside the scroll region so it is always in reach. -->
	<IconButton
		label={t('ui.addDiagram')}
		icon="plus"
		iconSize={12}
		stroke={2.5}
		class="shrink-0"
		onclick={() => runCommand('diagram.add')}
	/>

	<div class="ml-auto flex shrink-0 items-center gap-2">
		<div class="group-box">
			<!-- Undo and redo stay focusable while empty so the tooltip can say why they do nothing;
			     the tooltip's text differs from the name, so it wraps the button rather than being its own. -->
			<Tip text={projectStore.canUndo ? undoTitle : t('ui.nothingToUndo')} key={key('edit.undo')}>
				{#snippet children({ props })}
					<IconButton
						{...props}
						label={undoTitle}
						icon="undo"
						tip={false}
						aria-disabled={projectStore.canUndo ? undefined : true}
						{...describe(projectStore.canUndo ? undefined : t('ui.nothingToUndo'))}
						onclick={() => runCommand('edit.undo')}
					/>
				{/snippet}
			</Tip>
			<Tip text={projectStore.canRedo ? redoTitle : t('ui.nothingToRedo')} key={key('edit.redo')}>
				{#snippet children({ props })}
					<IconButton
						{...props}
						label={redoTitle}
						icon="redo"
						tip={false}
						aria-disabled={projectStore.canRedo ? undefined : true}
						{...describe(projectStore.canRedo ? undefined : t('ui.nothingToRedo'))}
						onclick={() => runCommand('edit.redo')}
					/>
				{/snippet}
			</Tip>
		</div>

		<div class="group-box">
			<IconButton
				label={t('ui.zoomOut')}
				icon="minus"
				key={key('zoom.out')}
				onclick={() => zoomBy(1 / 1.2)}
			/>
			<Tip text={t('ui.zoomReset')} key={key('zoom.reset')}>
				{#snippet children({ props })}
					<!-- Named by the percent it shows (WCAG 2.5.3); the tooltip says what a click does. -->
					<Button
						{...props}
						variant="ghost"
						size="sm"
						class="tabular-nums"
						data-testid="zoom-level"
						onclick={zoomReset}
					>
						{t('ui.zoomLevel', { percent: Math.round(ui.zoom * 100) })}
					</Button>
				{/snippet}
			</Tip>
			<IconButton
				label={t('ui.zoomIn')}
				icon="plus"
				key={key('zoom.in')}
				onclick={() => zoomBy(1.2)}
			/>
		</div>

		<Tip text={t('export.title')} key={key('file.export')}>
			{#snippet children({ props })}
				<Button {...props} onclick={() => runCommand('file.export')}>{t('ui.export')}</Button>
			{/snippet}
		</Tip>
		<div class="group-box">
			<IconButton
				label={t('ui.palette')}
				icon="terminal"
				key={key('view.palette')}
				onclick={() => runCommand('view.palette')}
			/>
		</div>
	</div>
</header>

<style>
	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-min);
		height: var(--control-min);
		color: var(--on-accent);
		background: var(--accent-fill);
		border-radius: var(--control-radius);
	}
	/* The tabs fill the bar's height so the underline sits on its bottom edge, and a deletable tab
	   keeps room on its right for the × that floats over it. */
	header :global(.tab) {
		height: auto;
		margin-bottom: -1px;
		align-self: stretch;
	}
	.deletable :global(.tab) {
		padding-right: var(--space-8);
	}
	/* A bordered pill holding one or more 28 px controls; the edge is a control edge (3:1), not a separator. */
	.group-box {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: var(--control-bar);
		padding: 0 1px;
		border: 1px solid var(--control-border);
		border-radius: var(--control-radius);
	}
</style>
