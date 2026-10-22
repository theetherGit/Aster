<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { tick } from 'svelte';
	import {
		addMember,
		deleteMember,
		membersOf,
		reorderMember,
		setMemberText
	} from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import {
		memberFromText,
		renderMember,
		SYM_OF,
		withVisibility,
		type Member,
		type MemberKind
	} from '#lib/mdj/expression.ts';
	import { newId } from '#lib/model/ids.ts';
	import { getClassifier, nextMemberText } from '#lib/model/project.ts';
	import type { Attribute, Classifier, Id, Visibility } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import KeyHint from '#lib/ui/molecules/KeyHint.svelte';
	import { hintKey } from '#lib/app/shortcuts.ts';
	import { menu, menuItem } from '#lib/ui/styles.ts';

	let { classifier, kind }: { classifier: Classifier; kind: MemberKind } = $props();

	// `classifier` is the inspector's clone for this project version; handlers read the live model,
	// so a commit followed at once by a move or an add never works from a stale copy.
	const members = $derived<Member[]>(membersOf(classifier, kind));
	const model = () => membersOf(getClassifier(projectStore.project, classifier.id), kind);
	const current = (id: Id) => model().find((m) => m.id === id);

	// Board 24's menu order.
	const VIS: Visibility[] = ['public', 'protected', 'package', 'private'];
	const isRaw = (m: Member) => 'raw' in m && m.raw !== undefined;
	/** The visibility shown in the row's column; literals and unparsed lines have none. */
	const visOf = (m: Member) =>
		kind === 'literal' || isRaw(m) ? undefined : (m as Attribute).visibility;
	/** The line as the field shows it: the symbol lives in its own column. */
	const shown = (m: Member) => renderMember(kind, m, { showVisibility: false });

	let root: HTMLFieldSetElement;
	let list = $state<HTMLUListElement>();
	let host = $state<HTMLDivElement>();
	/** The row whose line has focus and is being typed in (tint, bar, "↩ next · Esc"). */
	let editing = $state<Id | null>(null);

	/** A blank line is not a member: the field goes back to the model's text. */
	function commit(id: Id, input: HTMLInputElement) {
		const m = current(id);
		if (!m) return;
		const typed = input.value.trim();
		const v = visOf(m);
		const text = typed && v ? withVisibility(typed, v) : typed;
		if (!text) input.value = shown(m);
		else if (text !== renderMember(kind, m))
			projectStore.run(setMemberText, { classifierId: classifier.id, kind, memberId: id, text });
	}

	/** Visibility goes through the same text command as inline editing: re-render the line, then parse it. */
	function setVisibility(id: Id, visibility: Visibility) {
		const m = current(id);
		if (!m || !visOf(m) || visOf(m) === visibility) return;
		const text = renderMember(kind, { ...m, visibility } as Member);
		projectStore.run(setMemberText, { classifierId: classifier.id, kind, memberId: id, text });
	}

	function add() {
		const c = getClassifier(projectStore.project, classifier.id);
		const member = memberFromText(kind, nextMemberText(c, kind), newId());
		projectStore.run(addMember, { classifierId: c.id, kind, member });
	}

	/** One command for keys and drag; focus travels with the row it was on. */
	async function moveTo(id: Id, from: number, to: number) {
		const all = model();
		to = Math.max(0, Math.min(to, all.length - 1));
		if (to === from) return;
		const focused = document.activeElement as HTMLElement | null;
		const name = current(id)?.name ?? '';
		projectStore.run(
			reorderMember,
			{ classifierId: classifier.id, kind, memberId: id, to },
			t('live.memberMoved', { name, n: to + 1, total: all.length })
		);
		await tick();
		focused?.focus();
	}

	/** ⌘↑ / ⌘↓ one place, ⌘⇧↑ / ⌘⇧↓ to the ends (keyboard.md), from the line or a row button. */
	function moveKey(e: KeyboardEvent, id: Id, i: number) {
		if (e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.altKey) return;
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		const input = (e.currentTarget as HTMLElement).querySelector('input')!;
		if (document.activeElement === input) commit(id, input);
		const up = e.key === 'ArrowUp';
		void moveTo(id, i, e.shiftKey ? (up ? 0 : Infinity) : i + (up ? -1 : 1));
	}

	/** ↩ commits and opens the next line, adding one after the last; Esc puts the text back. */
	async function lineKey(e: KeyboardEvent, id: Id, i: number) {
		const input = e.currentTarget as HTMLInputElement;
		if (e.key === 'Escape' && editing === id) {
			e.preventDefault();
			e.stopPropagation();
			const m = current(id);
			if (m) input.value = shown(m);
			editing = null;
		} else if (e.key === 'Enter' && !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
			e.preventDefault();
			commit(id, input);
			const append = i === model().length - 1;
			if (append) add();
			await tick();
			const next = list?.querySelectorAll('input')[i + 1];
			if (!next) return;
			next.focus();
			if (append) next.select();
			else next.setSelectionRange(next.value.length, next.value.length);
		}
	}

	/** No confirm: the undo toast covers it (board 19). */
	async function remove(id: Id, i: number) {
		const name = current(id)?.name ?? '';
		projectStore.run(deleteMember, { classifierId: classifier.id, kind, memberId: id });
		ui.toast = { text: t('toast.deleted', { name }), undo: true, at: Date.now() };
		await tick();
		// The row's buttons are gone: the row that took its place, else the one above, else Add
		// (the fieldset's first button).
		const inputs = list?.querySelectorAll<HTMLInputElement>('input') ?? [];
		(inputs[Math.min(i, inputs.length - 1)] ?? root.querySelector('button'))?.focus();
	}

	// ---- Drag by the grip: pointer events, inside this compartment only -------------------------
	interface Drag {
		id: Id;
		from: number;
		/** Pointer offset into the row, so the lifted row does not jump to the pointer. */
		offset: number;
		/** Lifted row's top and the insertion line's y, both relative to `host`. */
		y: number;
		lineY: number;
		/** Insert before this row (rows.length: after the last); null while outside the list. */
		slot: number | null;
	}
	let drag = $state<Drag | null>(null);

	function grab(e: PointerEvent, id: Id, i: number) {
		if (e.button !== 0 || editing === id || !host) return;
		e.preventDefault(); // no text selection, no focus change
		const grip = e.currentTarget as HTMLElement;
		grip.setPointerCapture(e.pointerId);
		const top = grip.parentElement!.getBoundingClientRect().top;
		const offset = e.clientY - top;
		drag = { id, from: i, offset, y: top - host.getBoundingClientRect().top, lineY: 0, slot: null };
	}
	function follow(e: PointerEvent) {
		if (!drag || !host || !list) return;
		const top = host.getBoundingClientRect().top;
		drag.y = e.clientY - top - drag.offset;
		const box = list.getBoundingClientRect();
		const inside =
			e.clientX >= box.left &&
			e.clientX <= box.right &&
			e.clientY >= box.top &&
			e.clientY <= box.bottom;
		if (!inside) {
			drag.slot = null;
			return;
		}
		const rows = [...list.children].map((r) => r.getBoundingClientRect());
		const slot = rows.filter((r) => r.top + r.height / 2 < e.clientY).length;
		drag.slot = slot;
		drag.lineY = (slot < rows.length ? rows[slot].top : rows[rows.length - 1].bottom) - top;
	}
	function drop() {
		if (!drag) return;
		const { id, from, slot } = drag;
		drag = null;
		if (slot !== null) void moveTo(id, from, slot > from ? slot - 1 : slot);
	}
	function cancelOnEsc(e: KeyboardEvent) {
		if (!drag || e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		drag = null;
	}
	const lifted = $derived(drag ? members.find((m) => m.id === drag!.id) : undefined);
</script>

<svelte:window onkeydowncapture={cancelOnEsc} />

<!-- Board 24: one bordered list per compartment; 30 px rows on 1 px hairlines; the visibility in
     its own muted column; the line a flat field; actions beside it on hover or focus, never over it. -->
<fieldset class="mt-6 min-w-0" aria-labelledby="members-{kind}-title" bind:this={root}>
	<div class="head mb-1.5">
		<SectionHeading first id="members-{kind}-title">{t(`inspector.${kind}s`)}</SectionHeading>
		<Button size="sm" aria-label={t('inspector.add', { kind: t(`member.${kind}`) })} onclick={add}>
			<Icon name="plus" size={12} />{t('inspector.addShort')}
		</Button>
	</div>
	{#if members.length}
		<div class="relative" bind:this={host}>
			<ul
				class="rows overflow-hidden rounded-control border border-chrome-border bg-chrome-surface"
				aria-labelledby="members-{kind}-title"
				bind:this={list}
			>
				{#each members as m, i (m.id)}
					{@const v = visOf(m)}
					<!-- The row only hears ⌘↑ / ⌘↓ bubbling up from its own field and buttons. -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li
						class="row relative flex h-7.5 items-center gap-2 border-b border-chrome-border ps-2.5 pe-1.5 font-mono text-(length:--text-small) last:border-b-0"
						class:opacity-35={drag?.id === m.id}
						title={renderMember(kind, m)}
						data-editing={editing === m.id || undefined}
						onkeydown={(e) => moveKey(e, m.id, i)}
					>
						<!-- Pointer only, and so hidden from assistive tech: ⌘↑ / ⌘↓ are the same move
						     by keyboard, the Outline's row menu by one click. -->
						<span
							class="grip absolute start-0 top-0.75 z-1 flex size-6 cursor-grab touch-none items-center justify-center text-chrome-muted"
							data-grip
							aria-hidden="true"
							onpointerdown={(e) => grab(e, m.id, i)}
							onpointermove={follow}
							onpointerup={drop}
							onpointercancel={() => (drag = null)}
							onlostpointercapture={() => (drag = null)}
						>
							<Icon name="grip" size={12} stroke={3} />
						</span>
						<span class="vis w-2.5 shrink-0 text-chrome-muted" data-vis aria-hidden="true"
							>{v ? SYM_OF[v] : ''}</span
						>
						{#if v}
							<span class="sr-only" id="member-{m.id}-vis">{t(`vis.${v}`)}</span>
						{/if}
						{#if isRaw(m)}
							<span class="sr-only" id="member-{m.id}-raw">{t('inspector.unparsed')}</span>
						{/if}
						<Field
							class="h-full min-w-0 flex-1 truncate rounded-none border-0 bg-transparent px-0 font-mono text-(length:--text-small) {isRaw(
								m
							)
								? 'raw'
								: ''} {'isAbstract' in m && m.isAbstract ? 'italic' : ''}"
							aria-label={t(`member.line.${kind}`)}
							aria-describedby={[v && `member-${m.id}-vis`, isRaw(m) && `member-${m.id}-raw`]
								.filter(Boolean)
								.join(' ') || undefined}
							autocomplete="off"
							spellcheck="false"
							value={shown(m)}
							onfocus={() => (editing = m.id)}
							oninput={() => (editing = m.id)}
							onblur={() => {
								if (editing === m.id) editing = null;
							}}
							onchange={(e: Event) => commit(m.id, e.currentTarget as HTMLInputElement)}
							onkeydown={(e: KeyboardEvent) => lineKey(e, m.id, i)}
						/>
						{#if editing === m.id}
							<span
								class="shrink-0 text-(length:--text-caption) text-chrome-muted"
								aria-hidden="true"
								><KeyHint
									text={t('inspector.lineHint')}
									keys={{ enter: hintKey('↩'), esc: hintKey('Esc') }}
								/></span
							>
						{/if}
						<span class="actions sr-only flex shrink-0 items-center gap-0.5">
							{#if v}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger
										class="inline-flex size-6 items-center justify-center rounded-control border border-chrome-border font-mono text-chrome-muted hover:bg-chrome-surface"
										aria-label={t('inspector.memberVisibility', {
											name: m.name,
											value: t(`vis.${v}`)
										})}
									>
										{SYM_OF[v]}
									</DropdownMenu.Trigger>
									<DropdownMenu.Portal>
										<DropdownMenu.Content class={menu} sideOffset={4} align="end">
											<DropdownMenu.RadioGroup
												value={v}
												onValueChange={(next) => setVisibility(m.id, next as Visibility)}
											>
												{#each VIS as option (option)}
													<DropdownMenu.RadioItem value={option} class={menuItem}>
														{#snippet children({ checked })}
															<span class="w-3 font-mono text-chrome-muted" aria-hidden="true"
																>{SYM_OF[option]}</span
															>
															<span class={checked ? 'font-semibold text-accent-text' : ''}
																>{t(`vis.${option}`)}</span
															>
														{/snippet}
													</DropdownMenu.RadioItem>
												{/each}
											</DropdownMenu.RadioGroup>
										</DropdownMenu.Content>
									</DropdownMenu.Portal>
								</DropdownMenu.Root>
							{/if}
							<IconButton
								label={t('inspector.remove', { name: m.name, owner: classifier.name })}
								icon="x"
								iconSize={12}
								stroke={2.5}
								size={24}
								tip={false}
								class="text-danger"
								onclick={() => remove(m.id, i)}
							/>
						</span>
					</li>
				{/each}
			</ul>
			{#if drag}
				{#if drag.slot !== null}
					<div
						class="drop-line"
						data-drop-line
						aria-hidden="true"
						style:top="{drag.lineY - 1}px"
					></div>
				{/if}
				{#if lifted}
					{@const v = visOf(lifted)}
					<div
						class="ghost flex h-7.5 items-center gap-2 rounded-control border border-accent bg-chrome-surface ps-1 pe-2.5 font-mono text-(length:--text-small) shadow-menu"
						data-drag-ghost
						aria-hidden="true"
						style:top="{drag.y}px"
					>
						<Icon name="grip" size={12} stroke={3} class="shrink-0 text-chrome-muted" />
						<span class="w-2.5 shrink-0 text-chrome-muted">{v ? SYM_OF[v] : ''}</span>
						<span class="min-w-0 flex-1 truncate">{shown(lifted)}</span>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</fieldset>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* The heading shares a row with Add: no bottom gap of its own. */
	.head > :global(.section) {
		margin: 0;
	}

	/* Rest → hover → editing. Hover tints the row; editing tints it in the accent with a 2 px bar
	   at the start edge, which stands in for the field's own ring. */
	.row:hover {
		background: var(--chrome-bg);
	}
	.row[data-editing] {
		background: var(--selection-tint);
		box-shadow: inset 2px 0 var(--accent);
	}
	:global([dir='rtl']) .row[data-editing] {
		box-shadow: inset -2px 0 var(--accent);
	}
	.rows .row[data-editing] :global(input) {
		outline: none;
	}
	/* Focused but no longer editing (after Esc): the field's ring, inside the 30 px row. */
	.rows .row :global(input:focus-visible) {
		outline-offset: -2px;
	}
	.rows .row :global(button:focus-visible) {
		outline-offset: 0;
	}
	/* A line the grammar could not parse keeps the model's raw text, underlined in amber. */
	.rows :global(.raw) {
		box-shadow: inset 0 -2px var(--warning);
	}

	/* Actions are `sr-only` until the row is hovered or something in it has focus: no room taken,
	   yet in the Tab order (the skip link's pattern, not display: none). These unlayered rules
	   outweigh the utility. While the line is being edited the keys hint has their place. */
	.row:hover:not([data-editing]) .actions,
	.row:focus-within:not([data-editing]) .actions {
		position: static;
		width: auto;
		height: auto;
		margin: 0;
		overflow: visible;
		clip-path: none;
	}

	/* The grip shows on hover over the visibility column, which the visibility button repeats. */
	.grip {
		opacity: 0;
	}
	.row:hover:not([data-editing]) .grip {
		opacity: 1;
	}
	.row:hover:not([data-editing]) .vis {
		opacity: 0;
	}
	.row[data-editing] .grip {
		visibility: hidden;
	}

	/* Dragging: the lifted row and a 2 px accent line with a dot at the slot. */
	.ghost {
		position: absolute;
		inset-inline: var(--space-1);
		pointer-events: none;
		rotate: -0.6deg;
	}
	.drop-line {
		position: absolute;
		inset-inline: 6px;
		height: 2px;
		pointer-events: none;
		background: var(--accent);
	}
	.drop-line::before {
		position: absolute;
		inset-inline-start: -6px;
		top: -2px;
		width: 6px;
		height: 6px;
		content: '';
		background: var(--accent);
		border-radius: var(--radius-pill);
	}
	@media (prefers-reduced-motion: reduce) {
		.ghost {
			rotate: none;
		}
	}
	@media (forced-colors: active) {
		.rows .row[data-editing] :global(input) {
			outline: 2px solid Highlight;
			outline-offset: -2px;
		}
		.drop-line,
		.drop-line::before {
			forced-color-adjust: none;
			background: Highlight;
		}
	}
</style>
