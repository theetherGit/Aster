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
	import InlineName from './InlineName.svelte';
	import ProjectMenu from './ProjectMenu.svelte';
	import Tip from './Tip.svelte';

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
			/><circle cx="50" cy="50" r="11" fill="#f2b233" /></svg
		>
	</a>
	<h1 class="m-0 min-w-0 text-[15px]"><ProjectMenu /></h1>

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
					class="my-1.5 h-8 w-40 shrink-0 text-[13px]"
					oncommit={(name) => projectStore.run(renameDiagram, { diagramId: d.id, name })}
					ondone={() => renamed(d.id)}
				/>
			{:else}
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						{#snippet child({ props })}
							<Tabs.Trigger
								{...props}
								value={d.id}
								class="-mb-px shrink-0 border-b-2 border-transparent px-3 text-[13px] text-chrome-muted hover:text-chrome-text data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-chrome-text"
								ondblclick={() => rename(d.id)}
								onkeydown={(e: KeyboardEvent) => {
									if (e.key === 'F2') {
										e.preventDefault();
										rename(d.id);
									}
								}}
							>
								{d.name}
							</Tabs.Trigger>
						{/snippet}
					</ContextMenu.Trigger>
					<ContextMenu.Portal>
						<ContextMenu.Content class="menu">
							<ContextMenu.Item class="menu-item" onSelect={() => rename(d.id)}
								>{t('ui.renameDiagram')}</ContextMenu.Item
							>
							<ContextMenu.Item
								class="menu-item data-[disabled]:opacity-50"
								disabled={!canDelete}
								onSelect={() => {
									projectStore.activeDiagramId = d.id;
									runCommand('diagram.delete');
								}}>{t('ui.deleteDiagram')}</ContextMenu.Item
							>
						</ContextMenu.Content>
					</ContextMenu.Portal>
				</ContextMenu.Root>
			{/if}
		{/each}
	</Tabs.List>
	<!-- Board 01: the "+" after the last tab; outside the scroll region so it is always in reach. -->
	<Tip text={t('ui.addDiagram')}>
		{#snippet children({ props })}
			<button
				{...props}
				type="button"
				class="icon-btn shrink-0 text-chrome-muted"
				aria-label={t('ui.addDiagram')}
				onclick={() => runCommand('diagram.add')}
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
				>
			</button>
		{/snippet}
	</Tip>

	<div class="ml-auto flex shrink-0 items-center gap-2">
		<div class="group-box">
			<!-- Undo and redo stay focusable while empty so the tooltip can say why they do nothing. -->
			<Tip text={projectStore.canUndo ? undoTitle : t('ui.nothingToUndo')} key={key('edit.undo')}>
				{#snippet children({ props })}
					<button
						{...props}
						type="button"
						class="icon-btn"
						aria-label={undoTitle}
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
							aria-hidden="true"
							><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg
						>
					</button>
				{/snippet}
			</Tip>
			<Tip text={projectStore.canRedo ? redoTitle : t('ui.nothingToRedo')} key={key('edit.redo')}>
				{#snippet children({ props })}
					<button
						{...props}
						type="button"
						class="icon-btn"
						aria-label={redoTitle}
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
							aria-hidden="true"
							><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></svg
						>
					</button>
				{/snippet}
			</Tip>
		</div>

		<div class="group-box">
			<Tip text={t('ui.zoomOut')} key={key('zoom.out')}>
				{#snippet children({ props })}
					<button
						{...props}
						type="button"
						class="icon-btn"
						aria-label={t('ui.zoomOut')}
						onclick={() => zoomBy(1 / 1.2)}>−</button
					>
				{/snippet}
			</Tip>
			<Tip text={t('ui.zoomReset')} key={key('zoom.reset')}>
				{#snippet children({ props })}
					<!-- Named by the percent it shows (WCAG 2.5.3); the tooltip says what a click does. -->
					<button
						{...props}
						type="button"
						class="icon-btn w-auto px-1 text-[13px] tabular-nums"
						data-testid="zoom-level"
						onclick={zoomReset}
					>
						{t('ui.zoomLevel', { percent: Math.round(ui.zoom * 100) })}
					</button>
				{/snippet}
			</Tip>
			<Tip text={t('ui.zoomIn')} key={key('zoom.in')}>
				{#snippet children({ props })}
					<button
						{...props}
						type="button"
						class="icon-btn"
						aria-label={t('ui.zoomIn')}
						onclick={() => zoomBy(1.2)}>+</button
					>
				{/snippet}
			</Tip>
		</div>

		<Tip text={t('export.title')} key={key('file.export')}>
			{#snippet children({ props })}
				<button {...props} type="button" class="text-btn" onclick={() => runCommand('file.export')}>
					{t('ui.export')}
				</button>
			{/snippet}
		</Tip>
		<Tip text={t('ui.palette')} key={key('view.palette')}>
			{#snippet children({ props })}
				<button
					{...props}
					type="button"
					class="group-box icon-btn"
					aria-label={t('ui.palette')}
					onclick={() => runCommand('view.palette')}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"><path d="M5 7l5 5-5 5M12 17h7" /></svg
					>
				</button>
			{/snippet}
		</Tip>
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
		background: var(--accent-fill);
		border-radius: 6px;
	}
	/* Board 01's text button (Export): the pill's edge with a word's worth of padding. */
	.text-btn {
		height: 32px;
		padding: 0 12px;
		font-size: 13px;
		font-weight: 500;
		color: var(--chrome-text);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-control);
	}
	.text-btn:hover {
		background: var(--chrome-surface);
		border-color: var(--accent);
	}
	/* A bordered pill holding one or more 28 px controls; the edge is a control edge (3:1), not a separator. */
	.group-box {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: 32px;
		padding: 0 1px;
		border: 1px solid var(--control-border);
		border-radius: var(--radius-control);
	}
</style>
