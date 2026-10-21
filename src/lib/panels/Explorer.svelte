<script lang="ts">
	import { Combobox, ContextMenu } from 'bits-ui';
	import { useDebounce } from 'runed';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { format, matches, parse, type Shortcut } from '#lib/app/shortcuts.ts';
	import { deleteSelection } from '#lib/canvas/actions.ts';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { canvasFocus, explorerFocus } from '#lib/canvas/focus.ts';
	import { commitLine, renameClass } from '#lib/canvas/inline.ts';
	import { freePosition, rightOf } from '#lib/canvas/place.ts';
	import {
		addClassifier,
		addMember,
		deleteMember,
		membersOf,
		renameDiagram,
		renameProject,
		reorderMember,
		setRelationshipName
	} from '#lib/commands/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { memberFromText, renderMember, type MemberKind } from '#lib/mdj/expression.ts';
	import { newId } from '#lib/model/ids.ts';
	import { createClassifier, getClassifier, nextClassName } from '#lib/model/project.ts';
	import type { Classifier, Id } from '#lib/model/types.ts';
	import MenuItem from '#lib/ui/atoms/MenuItem.svelte';
	import InlineName from '#lib/ui/molecules/InlineName.svelte';
	import SkipLink from '#lib/ui/atoms/SkipLink.svelte';
	import { field, menu, menuItem } from '#lib/ui/styles.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import PanelTitle from '#lib/ui/atoms/PanelTitle.svelte';
	import PanelHeader from '#lib/ui/molecules/PanelHeader.svelte';
	import { panelSlide } from '#lib/ui/motion.ts';
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
	// role="tree" with a roving tabindex and the ARIA Authoring Practices keyboard, and (M2) a full
	// editing surface: every edit here runs the same commands as the canvas. Hand-built: no
	// primitive fits it; the per-row editors are real inputs, the menu and target list Bits.
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

	// ---- Editing (features.md Explorer / Outline, M2) ------------------------------------------

	/** The row's open editor: a rename or member text, a new member after a row, or a relationship target. */
	type Edit =
		| { kind: 'rename'; rowId: string }
		| {
				kind: 'new';
				afterRowId: string;
				level: number;
				owner: Id;
				memberKind: MemberKind;
				index: number;
		  }
		| { kind: 'target'; rowId: string; sourceId: Id };
	let editing: Edit | null = $state(null);
	/** The row of a member just added from the tree, to focus once its editor closes. */
	let created: string | null = null;
	const parentRowId = (id: string) => id.slice(0, id.lastIndexOf('/'));

	/** The default compartment of a classifier, as on the canvas: interfaces get operations. */
	const firstKind = (c: Classifier): MemberKind =>
		c.classifierKind === 'enum'
			? 'literal'
			: c.classifierKind === 'interface'
				? 'operation'
				: 'attribute';

	function renameValue(row: TreeRow): string {
		if (row.type === 'member') {
			const m = membersOf(getClassifier(projectStore.project, row.owner!), row.memberKind!)[
				row.memberIndex!
			];
			return m ? renderMember(row.memberKind!, m) : '';
		}
		if (row.type === 'relationship') {
			const r = projectStore.project.elements.get(row.elementId!);
			return r?.kind === 'relationship' ? (r.name ?? '') : '';
		}
		return row.label;
	}
	function rename(row: TreeRow, text: string) {
		if (row.type === 'project') projectStore.run(renameProject, { name: text });
		else if (row.type === 'diagram')
			projectStore.run(renameDiagram, { diagramId: row.diagramId!, name: text });
		else if (row.type === 'classifier') renameClass(row.elementId!, text);
		else if (row.type === 'relationship')
			projectStore.run(setRelationshipName, { id: row.elementId!, name: text });
		else if (row.type === 'member') commitLine(row.owner!, row.memberKind!, row.memberIndex!, text);
	}
	async function endEdit(focusId: string) {
		editing = null;
		await focusRow(focusId);
	}

	/** A new member of `kind` at `index`, typed in a row after `afterRowId`; one undo step when committed. */
	async function newMember(
		owner: Id,
		kind: MemberKind,
		index: number,
		classifierRowId: string,
		level: number
	) {
		expanded.add(classifierRowId);
		await tick();
		const before = rows.filter(
			(r) => r.owner === owner && r.memberKind === kind && r.memberIndex! < index
		);
		editing = {
			kind: 'new',
			afterRowId: before.at(-1)?.id ?? classifierRowId,
			level,
			owner,
			memberKind: kind,
			index
		};
	}
	function commitNew(e: Extract<Edit, { kind: 'new' }>, text: string): string | null {
		const member = memberFromText(e.memberKind, text, newId());
		projectStore.run(addMember, {
			classifierId: e.owner,
			kind: e.memberKind,
			member,
			index: e.index
		});
		const classifierRow = e.afterRowId.includes('/member:')
			? parentRowId(e.afterRowId)
			: e.afterRowId;
		return `${classifierRow}/member:${member.id}`;
	}

	/** A class on a diagram (made active, so the canvas places it in free space), its name open here. */
	async function newClass(diagramId: Id, besideId?: Id) {
		projectStore.activeDiagramId = diagramId;
		const r = canvasApi.rects();
		const beside = besideId ? r.get(besideId) : undefined;
		const at = (beside ? rightOf([beside]) : null) ?? { x: 40, y: 40 };
		const classifier = createClassifier({ name: nextClassName(projectStore.project) });
		projectStore.run(addClassifier, { diagramId, classifier, at: freePosition(at, r.values()) });
		selection.set([classifier.id]);
		expanded.add(ROOT);
		expanded.add(diagramRowId(diagramId));
		const id = rowIdFor(classifier.id, diagramId);
		await focusRow(id);
		editing = { kind: 'rename', rowId: id };
	}
	async function newDiagram() {
		runCommand('diagram.add');
		expanded.add(ROOT);
		const id = diagramRowId(projectStore.activeDiagramId);
		await focusRow(id);
		editing = { kind: 'rename', rowId: id };
	}

	/** ⌫ and ⌘⌫, through the canvas's own delete (the undo toast included); focus stays in the tree. */
	async function remove(i: number, fromModel: boolean) {
		const row = rows[i];
		if (row.type === 'member') {
			projectStore.run(deleteMember, {
				classifierId: row.owner!,
				kind: row.memberKind!,
				memberId: row.memberId!
			});
		} else if (row.type === 'diagram') {
			if (projectStore.project.diagrams.length > 1)
				ui.confirmDelete = { diagramId: row.diagramId! };
			return;
		} else if (row.elementId) {
			if (!fromModel && !row.diagramId) return; // on no diagram: nothing to remove it from
			select(i);
			deleteSelection(fromModel);
		} else return;
		await tick();
		if (rows.length) focusRow(rows[Math.min(i, rows.length - 1)].id);
	}

	/** One place, or ±Infinity to the top / bottom (⌘⇧↑ / ⌘⇧↓). */
	async function reorder(row: TreeRow, delta: number) {
		const list = membersOf(getClassifier(projectStore.project, row.owner!), row.memberKind!);
		const to = Math.max(0, Math.min(row.memberIndex! + delta, list.length - 1));
		if (to === row.memberIndex) return;
		projectStore.run(reorderMember, {
			classifierId: row.owner!,
			kind: row.memberKind!,
			memberId: row.memberId!,
			to
		});
		await focusRow(row.id);
	}

	// M2.3 prompt: members reorder by drag as well as ⌘↑ / ⌘↓, within one compartment, through
	// the same reorderMember command.
	let dragged: TreeRow | null = $state(null);
	const canDrop = (row: TreeRow) =>
		!!dragged &&
		row.type === 'member' &&
		row.id !== dragged.id &&
		row.owner === dragged.owner &&
		row.memberKind === dragged.memberKind;
	async function dropOn(row: TreeRow) {
		const from = dragged!;
		dragged = null;
		projectStore.run(reorderMember, {
			classifierId: from.owner!,
			kind: from.memberKind!,
			memberId: from.memberId!,
			to: row.memberIndex!
		});
		await focusRow(from.id);
	}

	interface Action {
		label: string;
		keys: Shortcut[];
		run: () => void;
		disabled?: boolean;
	}
	const keys = (...specs: string[]) => specs.map(parse);
	const memberLabel = (kind: MemberKind) => t(`outline.add.${kind}` as MessageKey);
	/**
	 * What a row offers, keyed as keyboard.md has it where it has a row (F2, ⌫, ⌘⌫, ⌘↑ / ⌘↓,
	 * ⇧F10) and as the M2 Outline prompt has it otherwise (⌘↩ sibling, ⌘⇧↩ child). The keys
	 * and the ⇧F10 menu read this one list.
	 */
	function actionsFor(row: TreeRow | undefined, i: number): Action[] {
		if (!row) return [];
		const renameIt: Action = {
			label: t(row.type === 'member' ? 'outline.edit' : 'outline.rename'),
			keys: keys('F2'),
			run: () => (editing = { kind: 'rename', rowId: row.id })
		};
		const del = (fromModel: boolean): Action => ({
			label: t(fromModel ? 'cmd.deleteFromModelCmd' : 'cmd.removeFromDiagram'),
			keys: fromModel ? keys('⌘⌫') : keys('⌫', 'Delete'),
			run: () => remove(i, fromModel),
			disabled: !fromModel && !row.diagramId
		});
		switch (row.type) {
			case 'project':
				return [renameIt, { label: t('outline.addDiagram'), keys: keys('⌘⇧↩'), run: newDiagram }];
			case 'diagram':
				return [
					renameIt,
					{
						label: t('outline.addClass'),
						keys: keys('⌘⇧↩'),
						run: () => newClass(row.diagramId!)
					},
					{ label: t('outline.addDiagram'), keys: keys('⌘↩'), run: newDiagram },
					{
						label: t('ui.deleteDiagram'),
						keys: keys('⌫', 'Delete'),
						run: () => remove(i, false),
						disabled: projectStore.project.diagrams.length < 2
					}
				];
			case 'classifier': {
				const c = getClassifier(projectStore.project, row.elementId!);
				const add = (kind: MemberKind, spec: string[]): Action => ({
					label: memberLabel(kind),
					keys: keys(...spec),
					run: () => newMember(c.id, kind, membersOf(c, kind).length, row.id, row.level + 1)
				});
				const first = firstKind(c);
				return [
					renameIt,
					add(first, ['⌘⇧↩']),
					...(['attribute', 'operation'] as const)
						.filter((k) => k !== first && c.classifierKind !== 'enum')
						.map((k) => add(k, [])),
					{
						label: t('outline.addClass'),
						keys: keys('⌘↩'),
						run: () => newClass(row.diagramId ?? projectStore.activeDiagramId, c.id)
					},
					{
						label: t('outline.createRelationship'),
						keys: [],
						run: () => (editing = { kind: 'target', rowId: row.id, sourceId: c.id })
					},
					del(false),
					del(true)
				];
			}
			case 'member':
				return [
					renameIt,
					{
						label: t('outline.addBelow'),
						keys: keys('⌘↩'),
						run: () =>
							newMember(
								row.owner!,
								row.memberKind!,
								row.memberIndex! + 1,
								parentRowId(row.id),
								row.level
							)
					},
					{ label: t('outline.moveUp'), keys: keys('⌘↑'), run: () => reorder(row, -1) },
					{ label: t('outline.moveDown'), keys: keys('⌘↓'), run: () => reorder(row, 1) },
					{ label: t('outline.moveTop'), keys: keys('⌘⇧↑'), run: () => reorder(row, -Infinity) },
					{ label: t('outline.moveBottom'), keys: keys('⌘⇧↓'), run: () => reorder(row, Infinity) },
					{
						label: t('outline.delete'),
						keys: keys('⌫', 'Delete', '⌘⌫'),
						run: () => remove(i, true)
					}
				];
			case 'relationship':
				return [renameIt, del(false), del(true)];
			default:
				return [];
		}
	}

	// ⇧F10 and right-click: the focused row's actions (keyboard.md), one Bits ContextMenu for the tree.
	let menuRow: number = $state(-1);
	function oncontextmenu(e: MouseEvent, open: ((e: MouseEvent) => void) | undefined) {
		const li = (e.target as Element | null)?.closest<HTMLElement>('[role="treeitem"][data-row-id]');
		const i = li ? rows.findIndex((r) => r.id === li.dataset.rowId) : -1;
		if (i < 0 || !actionsFor(rows[i], i).length) return e.preventDefault();
		menuRow = i;
		focusRow(rows[i].id);
		open?.(e);
	}
	function openMenu() {
		const li = treeEl.querySelector<HTMLElement>(
			`[data-row-id="${CSS.escape(rows[focusedIndex].id)}"]`
		);
		const r = li?.getBoundingClientRect();
		if (!li || !r) return;
		li.dispatchEvent(
			new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				clientX: r.left + 24,
				clientY: r.bottom
			})
		);
	}

	// "Create relationship…": a searchable list of classifiers, then the kind picker.
	const classifiers = $derived.by(() => {
		void projectStore.version;
		return [...projectStore.project.elements.values()]
			.filter((e): e is Classifier => e.kind === 'classifier')
			.map((c) => ({ value: c.id, label: c.name || t('validation.unnamed') }));
	});
	let targetQuery = $state('');
	let targetOpen = $state(false);
	const targets = $derived(
		classifiers.filter((c) => c.label.toLowerCase().includes(targetQuery.trim().toLowerCase()))
	);
	function pickTarget(e: Extract<Edit, { kind: 'target' }>, targetId: string) {
		const li = treeEl.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(e.rowId)}"]`);
		const r = li?.getBoundingClientRect();
		const rowId = e.rowId;
		editing = null;
		targetQuery = '';
		const i = rows.findIndex((x) => x.id === rowId);
		if (i >= 0) select(i);
		ui.picker = {
			sourceId: e.sourceId,
			targetId,
			x: (r?.left ?? 0) + 24,
			y: r?.bottom ?? 0,
			restore: () => focusRow(rowId)
		};
	}

	function onkeydown(e: KeyboardEvent) {
		// The row's own editor keeps its keys.
		if (e.target instanceof HTMLInputElement) return;
		const i = focusedIndex;
		const row = rows[i];
		const action = actionsFor(row, i).find((a) => a.keys.some((k) => matches(e, k)));
		if (action) {
			if (!action.disabled) action.run();
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (e.key === 'F10' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
			openMenu();
			e.preventDefault();
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
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
{#snippet body()}
	<!-- accessibility.md: the panel's first focusable skips back to the diagram. -->
	<SkipLink label={t('app.skipToCanvas')} go={() => canvasFocus.focus()} />
	{#if variant === 'classic'}
		<PanelTitle id="explorer-title">{t('classic.modelExplorer')}</PanelTitle>
	{:else}
		<PanelHeader
			title={t('explorer.title')}
			id="explorer-title"
			closeLabel={t('explorer.hide')}
			closeIcon="panel-left-close"
			closeKey={format(byId('view.outline')!.keys[0])}
			onclose={() => (ui.panels.outline = false)}
		/>
	{/if}
	<ContextMenu.Root>
		<ContextMenu.Trigger>
			{#snippet child({ props })}
				<ul
					{...props}
					role="tree"
					aria-label={t('explorer.tree')}
					bind:this={treeEl}
					class="pb-3"
					{onkeydown}
					onfocusin={(e) => {
						// Focus can arrive from outside the tree's own keys (a click, a script, assistive tech).
						const id = (e.target as HTMLElement).dataset?.rowId;
						if (id) focusedId = id;
					}}
					oncontextmenu={(e) =>
						oncontextmenu(e, props.oncontextmenu as ((e: MouseEvent) => void) | undefined)}
				>
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
							class="row flex h-7 items-center gap-1 pe-3 text-chrome-text aria-selected:bg-accent/10 aria-selected:shadow-[inset_3px_0_0_var(--accent)] rtl:aria-selected:shadow-[inset_-3px_0_0_var(--accent)]"
							style:padding-inline-start="{(row.level - 1) * 12 + 4}px"
							onclick={(e) => {
								if (!(e.target as Element).closest('input')) onclick(i);
							}}
							ondblclick={() => {
								if (row.elementId && !editing) canvasFocus.focus();
							}}
							draggable={row.type === 'member' && !editing}
							ondragstart={(e) => {
								dragged = row;
								e.dataTransfer?.setData('text/plain', row.label);
								if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
							}}
							ondragover={(e) => {
								if (!canDrop(row)) return;
								e.preventDefault();
								if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
							}}
							ondrop={(e) => {
								if (!canDrop(row)) return;
								e.preventDefault();
								dropOn(row);
							}}
							ondragend={() => (dragged = null)}
							class:drop-target={canDrop(row)}
						>
							{#if row.hasChildren}
								<!-- The tree is hand-built (design.md): its expander is decorative, not an IconButton. -->
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
									<Icon
										name="chevron-right"
										size={12}
										class={row.expanded ? 'rotate-90' : 'rtl:rotate-180'}
									/>
								</button>
							{:else}
								<span class="w-6 shrink-0"></span>
							{/if}
							{#if editing?.kind === 'rename' && editing.rowId === row.id}
								<InlineName
									value={renameValue(row)}
									label={t(row.type === 'member' ? 'outline.lineLabel' : 'outline.nameLabel')}
									class="h-6 min-w-0 flex-1 {row.type === 'member' ? 'font-mono' : ''}"
									oncommit={(text) => rename(row, text)}
									ondone={() => endEdit(row.id)}
								/>
							{:else if editing?.kind === 'target' && editing.rowId === row.id}
								{@const ed = editing}
								<Combobox.Root
									type="single"
									items={targets}
									bind:open={targetOpen}
									onValueChange={(v) => {
										if (v) pickTarget(ed, v);
									}}
								>
									<Combobox.Input
										class="{field} h-6 min-w-0 flex-1"
										aria-label={t('outline.target')}
										autocomplete="off"
										oninput={(e) => {
											targetQuery = e.currentTarget.value;
											targetOpen = true;
										}}
										onkeydown={(e: KeyboardEvent) => {
											if (e.key === 'Escape' && !targetOpen) {
												e.preventDefault();
												targetQuery = '';
												endEdit(row.id);
											}
										}}
										{@attach (node) => (node as HTMLInputElement).focus()}
									/>
									<Combobox.Portal>
										<Combobox.Content class={menu} sideOffset={4} align="start">
											<Combobox.Viewport>
												{#each targets as option (option.value)}
													<Combobox.Item value={option.value} label={option.label} class={menuItem}
														>{option.label}</Combobox.Item
													>
												{/each}
											</Combobox.Viewport>
										</Combobox.Content>
									</Combobox.Portal>
								</Combobox.Root>
							{:else}
								<span class="truncate" class:italic={row.italic} title={row.label} dir="auto"
									>{row.label}</span
								>
								{#if row.hint}<span
										class="ms-2 shrink-0 text-(length:--text-small) text-chrome-muted"
										>{row.hint}</span
									>{/if}
							{/if}
						</li>
						{#if editing?.kind === 'new' && editing.afterRowId === row.id}
							{@const ed = editing}
							<!-- The member being written: not in the model until it is committed (one undo step). -->
							<li
								role="treeitem"
								aria-level={ed.level}
								aria-selected="false"
								class="row flex h-7 items-center gap-1 pe-3"
								style:padding-inline-start="{(ed.level - 1) * 12 + 4}px"
							>
								<span class="w-6 shrink-0"></span>
								<InlineName
									value=""
									label={t('outline.newMember', { kind: t(`member.${ed.memberKind}`) })}
									class="h-6 min-w-0 flex-1 font-mono"
									oncommit={(text) => (created = commitNew(ed, text))}
									ondone={() => {
										const back = created ?? ed.afterRowId;
										created = null;
										endEdit(back);
									}}
								/>
							</li>
						{/if}
					{/each}
				</ul>
			{/snippet}
		</ContextMenu.Trigger>
		<ContextMenu.Portal>
			<ContextMenu.Content
				class={menu}
				aria-label={t('outline.menu')}
				onCloseAutoFocus={(e) => {
					e.preventDefault();
					if (!editing && rows[menuRow]) focusRow(rows[menuRow].id);
				}}
			>
				{#each actionsFor(rows[menuRow], menuRow) as a (a.label)}
					<MenuItem
						kind="context"
						label={a.label}
						keys={a.keys[0] ? format(a.keys[0]) : undefined}
						disabled={a.disabled}
						onSelect={a.run}
					/>
				{/each}
			</ContextMenu.Content>
		</ContextMenu.Portal>
	</ContextMenu.Root>
	{#if empty}
		<p class="px-4 pb-3 text-(length:--text-small) text-chrome-muted">{t('explorer.empty')}</p>
	{/if}
{/snippet}

{#if variant === 'classic'}
	<!-- Classic: a section inside the sidebar's aside, never a nested landmark. -->
	<section aria-labelledby="explorer-title" class="flex min-h-0 flex-1 flex-col overflow-auto">
		{@render body()}
	</section>
{:else}
	<!-- The slide (ui.md motion) animates this wrapper's width and clips; the panel inside keeps
	     its 240 px, so nothing reflows while it moves. -->
	<div transition:panelSlide|global class="flex shrink-0 overflow-hidden">
		<aside
			aria-labelledby="explorer-title"
			class="flex w-[240px] shrink-0 flex-col overflow-auto border-e border-chrome-border bg-chrome-surface"
		>
			{@render body()}
		</aside>
	</div>
{/if}

<style>
	/* While a member is dragged, the rows it may land on show where. */
	.row.drop-target:hover {
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	.row:focus-visible {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}
</style>
