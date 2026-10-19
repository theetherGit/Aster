<script lang="ts">
	import { useDebounce } from 'runed';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { canvasFocus, explorerFocus } from '#lib/canvas/focus.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Icon from './Icon.svelte';
	import {
		ROOT,
		buildRows,
		diagramRowId,
		parentIndex,
		rowIdFor,
		tabStopIndex,
		typeAheadIndex,
		type TreeRow
	} from './tree.ts';

	// Modern: the 240 px Outline drawer. Classic: the Model Explorer, filling its column (board 03).
	let { variant = 'modern' }: { variant?: 'modern' | 'classic' } = $props();
	// Read-only tree (editing from the tree is M2). role="tree" with a roving tabindex and
	// the ARIA Authoring Practices keyboard. Hand-built: no primitive fits it.
	// Board 01: the project and the open diagram start expanded.
	const expanded = new SvelteSet<string>([ROOT, diagramRowId(projectStore.activeDiagramId)]);
	let focusedId = $state(ROOT);
	let treeEl: HTMLUListElement;
	let buffer = '';
	const clearBuffer = useDebounce(() => (buffer = ''), 500);

	const rows = $derived(buildRows(projectStore.project, expanded));
	// The selected element's row in the open diagram (or under the project when unplaced).
	const selectedId = $derived(selection.size === 1 ? selection.list[0] : null);
	const isSelectedRow = (row: TreeRow) =>
		row.elementId === selectedId &&
		(!row.diagramId || row.diagramId === projectStore.activeDiagramId);
	// The one row in the Tab order: the focused row, else its nearest visible ancestor, else the first.
	const focusedIndex = $derived(tabStopIndex(rows, focusedId));
	// ui.md "Outline: empty": the model holds no classifier or package.
	const empty = $derived.by(() => {
		void projectStore.version;
		return ![...projectStore.project.elements.values()].some(
			(e) => e.kind === 'classifier' || e.kind === 'package'
		);
	});

	async function focusRow(id: string) {
		focusedId = id;
		await tick();
		treeEl.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
	}

	function select(i: number) {
		const row = rows[i];
		if (!row?.elementId) return;
		// A row under another diagram opens that diagram first, as the diagram tabs do.
		if (row.diagramId && row.diagramId !== projectStore.activeDiagramId)
			projectStore.activeDiagramId = row.diagramId;
		selection.set([row.elementId]);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const i = focusedIndex;
		const row = rows[i];
		switch (e.key) {
			case 'ArrowDown':
				if (i + 1 < rows.length) focusRow(rows[i + 1].id);
				break;
			case 'ArrowUp':
				if (i > 0) focusRow(rows[i - 1].id);
				break;
			case 'ArrowRight':
				if (!row.hasChildren) return;
				if (!row.expanded) expanded.add(row.id);
				else if (i + 1 < rows.length) focusRow(rows[i + 1].id);
				break;
			case 'ArrowLeft':
				if (row.expanded) expanded.delete(row.id);
				else {
					const p = parentIndex(rows, i);
					if (p >= 0) focusRow(rows[p].id);
				}
				break;
			case 'Home':
				focusRow(rows[0].id);
				break;
			case 'End':
				focusRow(rows[rows.length - 1].id);
				break;
			case 'Enter':
			case ' ':
				select(i);
				break;
			default: {
				if (e.key.length !== 1 || e.key === ' ') return;
				buffer += e.key;
				void clearBuffer();
				const next = typeAheadIndex(rows, i, buffer);
				if (next >= 0) focusRow(rows[next].id);
			}
		}
		e.preventDefault();
	}

	function onclick(i: number) {
		focusRow(rows[i].id);
		select(i);
	}
	function toggle(i: number) {
		const row = rows[i];
		if (row.expanded) {
			expanded.delete(row.id);
			// Collapsing over the focused row: focus moves up to the row that hid it.
			if (focusedId.startsWith(row.id + '/')) focusRow(row.id);
		} else expanded.add(row.id);
	}

	// ⌘E: reveal the selected element and move focus to its row.
	$effect(() => {
		explorerFocus.reveal = (id) => {
			expanded.add(ROOT);
			const did = projectStore.activeDiagramId;
			const onDiagram = id ? projectStore.diagram.elementIds.includes(id) : false;
			const scope = onDiagram ? did : undefined;
			if (onDiagram) expanded.add(diagramRowId(did));
			const el = id ? projectStore.project.elements.get(id) : undefined;
			if (el?.kind === 'relationship') expanded.add(rowIdFor(el.sourceId, scope));
			focusRow(id ? rowIdFor(id, scope) : ROOT);
		};
		if (explorerFocus.pending) {
			const id = explorerFocus.pending;
			explorerFocus.pending = null;
			explorerFocus.reveal(id);
		}
		return () => {
			explorerFocus.reveal = () => {};
		};
	});
</script>

<!-- Modern: a landmark of its own. Classic: a section inside the sidebar's aside, never a nested one. -->
<svelte:element
	this={variant === 'classic' ? 'section' : 'aside'}
	aria-labelledby="explorer-title"
	class={variant === 'classic'
		? 'flex min-h-0 flex-1 flex-col overflow-auto'
		: 'flex w-[240px] shrink-0 flex-col overflow-auto border-r border-chrome-border bg-chrome-surface'}
>
	{#if variant === 'classic'}
		<h2 class="panel-title" id="explorer-title">{t('classic.modelExplorer')}</h2>
	{:else}
		<div class="flex items-center justify-between pr-2 pl-4">
			<h2
				class="py-3 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
				id="explorer-title"
			>
				{t('explorer.title')}
			</h2>
			<button
				type="button"
				class="icon-btn w-auto px-1.5 text-[11px] text-chrome-muted"
				onclick={() => (ui.panels.outline = false)}
				><span class="sr-only">{t('explorer.hide')}</span><kbd aria-hidden="true"
					>{format(byId('view.outline')!.keys[0])}</kbd
				></button
			>
		</div>
	{/if}
	<ul role="tree" aria-label={t('explorer.tree')} bind:this={treeEl} class="pb-3" {onkeydown}>
		{#each rows as row, i (row.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				role="treeitem"
				data-row-id={row.id}
				aria-level={row.level}
				aria-setsize={row.setsize}
				aria-posinset={row.posinset}
				aria-expanded={row.hasChildren ? row.expanded : undefined}
				aria-selected={isSelectedRow(row)}
				tabindex={i === focusedIndex ? 0 : -1}
				class="row flex h-7 items-center gap-1 pr-3 text-chrome-text aria-selected:bg-accent/10 aria-selected:shadow-[inset_3px_0_0_var(--accent)]"
				style:padding-left="{(row.level - 1) * 12 + 4}px"
				onclick={() => onclick(i)}
				ondblclick={() => {
					if (row.elementId) canvasFocus.focus();
				}}
			>
				{#if row.hasChildren}
					<button
						type="button"
						tabindex="-1"
						aria-hidden="true"
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-chrome-muted hover:bg-chrome-bg"
						onclick={(e) => {
							e.stopPropagation();
							toggle(i);
						}}
					>
						<Icon name="chevron-right" size={12} class={row.expanded ? 'rotate-90' : ''} />
					</button>
				{:else}
					<span class="w-6 shrink-0"></span>
				{/if}
				<span class="truncate" class:italic={row.italic} title={row.label}>{row.label}</span>
				{#if row.hint}<span class="ml-2 shrink-0 text-[12px] text-chrome-muted">{row.hint}</span
					>{/if}
			</li>
		{/each}
	</ul>
	{#if empty}
		<p class="px-4 pb-3 text-[12px] text-chrome-muted">{t('explorer.empty')}</p>
	{/if}
</svelte:element>

<style>
	.row:focus-visible {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}
</style>
