<script lang="ts">
	import { useDebounce } from 'runed';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { canvasFocus, explorerFocus } from '#lib/canvas/focus.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import {
		ROOT,
		buildRows,
		diagramRowId,
		parentIndex,
		rowIdFor,
		typeAheadIndex,
		type TreeRow
	} from './tree.ts';

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
	const focusedIndex = $derived(
		Math.max(
			0,
			rows.findIndex((r) => r.id === focusedId)
		)
	);

	async function focusRow(id: string) {
		focusedId = id;
		await tick();
		treeEl.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
	}

	function select(i: number) {
		const row = rows[i];
		if (row?.elementId) selection.set([row.elementId]);
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
		if (row.expanded) expanded.delete(row.id);
		else expanded.add(row.id);
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

<aside
	aria-label={t('explorer.title')}
	class="flex w-[240px] shrink-0 flex-col overflow-auto border-r border-chrome-border bg-chrome-surface"
>
	<div class="flex items-center justify-between pr-2 pl-4">
		<h2 class="py-3 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase">
			{t('explorer.title')}
		</h2>
		<button
			type="button"
			class="icon-btn w-auto px-1.5 text-[11px] text-chrome-muted"
			aria-label={t('explorer.hide')}
			title={t('explorer.hide')}
			onclick={() => (ui.panels.outline = false)}>{t('explorer.shortcut')}</button
		>
	</div>
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
				tabindex={row.id === focusedId ? 0 : -1}
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
						class="flex h-6 w-5 shrink-0 items-center justify-center rounded-control text-chrome-muted hover:bg-chrome-bg"
						onclick={(e) => {
							e.stopPropagation();
							toggle(i);
						}}
					>
						<svg
							width="10"
							height="10"
							viewBox="0 0 10 10"
							class={row.expanded ? 'rotate-90' : ''}
							fill="currentColor"><path d="M3 1l4 4-4 4z" /></svg
						>
					</button>
				{:else}
					<span class="w-5 shrink-0"></span>
				{/if}
				<span class="truncate" class:italic={row.italic}>{row.label}</span>
				{#if row.hint}<span class="ml-2 shrink-0 text-[12px] text-chrome-muted">{row.hint}</span
					>{/if}
			</li>
		{/each}
	</ul>
</aside>

<style>
	.row:focus-visible {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}
</style>
