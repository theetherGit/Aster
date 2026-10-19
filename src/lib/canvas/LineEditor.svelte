<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import type { MemberKind } from '#lib/mdj/expression.ts';
	import type { Id } from '#lib/model/types.ts';
	import { flow } from '#lib/stores/flow.svelte.ts';
	import { canvasFocus } from './focus.ts';
	import { selection, sameTarget, type EditTarget } from '#lib/stores/selection.svelte.ts';
	import {
		addLineBelow,
		commitLine,
		commitName,
		endEditing,
		lineEnter,
		moveCompartment,
		nameEnter,
		reorderLine
	} from './inline.ts';

	interface Props {
		id: Id;
		target: EditTarget;
		initial: string;
		label: string;
		/** Select the whole text (names) instead of placing the caret at the end (lines). */
		selectAll?: boolean;
		ondraft?: (text: string) => void;
	}
	let { id, target, initial, label, selectAll = false, ondraft }: Props = $props();

	// An editor belongs to the line it was opened for. The caller's `target` is reactive (an
	// each-block index), so a reorder would otherwise retarget this editor before teardown.
	// svelte-ignore state_referenced_locally
	const own = { ...target } as { part: 'name' } | { part: MemberKind; index: number };
	// Notes and text elements have their own editor; this one is for names and member lines.

	// The draft deliberately starts from the initial text and then lives on its own.
	// svelte-ignore state_referenced_locally
	let draft = $state(initial);
	$effect(() => ondraft?.(draft));

	const isCurrent = () =>
		selection.editing?.id === id && sameTarget(selection.editing.target, own as EditTarget);
	const kindLabel = (part: MemberKind | 'name') =>
		part === 'name' ? t('ui.className') : t(`member.line.${part}`);
	const ariaLabel = $derived(label || kindLabel(own.part));
	// Ghost text (features list #6): the grammar's shape, so nobody has to recall it.
	const placeholder = own.part === 'name' ? undefined : t(`member.placeholder.${own.part}`);

	// A brand-new node stays hidden until Svelte Flow first measures it, and a hidden input
	// cannot take focus, so retry for a few frames until focus sticks.
	function focusInput(node: HTMLInputElement) {
		let frame = 0;
		let tries = 0;
		const attempt = () => {
			node.focus();
			if (selectAll) node.select();
			else node.setSelectionRange(node.value.length, node.value.length);
			if (document.activeElement !== node && tries++ < 30) frame = requestAnimationFrame(attempt);
		};
		attempt();
		return {
			destroy: () => {
				cancelAnimationFrame(frame);
				// Torn down while it held focus (an undo, a re-render): the canvas takes focus
				// back, so focus is never dropped on the body. A blur that went somewhere stays.
				queueMicrotask(() => {
					if (document.activeElement === document.body) canvasFocus.focus();
				});
			}
		};
	}

	function commit() {
		if (own.part === 'name') commitName(id, draft);
		else commitLine(id, own.part, own.index, draft);
	}

	// ---- Type-name completion (attribute and operation lines) -------------------------------
	// Offered as whole-line values so accepting one replaces the line; filtered by the token
	// after the last colon; an exact match offers nothing, so Enter commits straight away.
	const completes = $derived(own.part === 'attribute' || own.part === 'operation');
	const options = $derived.by(() => {
		if (!completes) return [];
		const m = /^(.*:\s*)([\w<>.]*)$/.exec(draft);
		if (!m) return [];
		const token = m[2].toLowerCase();
		return flow.typeNames
			.filter((n) => n.toLowerCase().startsWith(token) && n.toLowerCase() !== token)
			.map((n) => ({ value: m[1] + n, label: n }));
	});
	// Fully controlled: Bits never opens an empty list, so there is nothing mid-open to race
	// with Enter when a line has no completions.
	let open = $state(false);
	$effect(() => {
		if (options.length === 0) open = false;
	});
	const highlighted = () =>
		document.querySelector('[data-combobox-item][data-highlighted]') !== null;

	// Only what the editor consumes stops here: typing, Enter, Esc, Tab, the list's arrows and
	// the ⌘ keys of keyboard.md's editing rows. App chords (⌘S, ⌘Z, ⌘K, ⌘B …) go on to the
	// window handler, which runs them and keeps the browser's own default from firing.
	function onkeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod && !e.altKey) e.stopPropagation();
		if (e.key === 'Escape') {
			if (open) return; // Bits closes the list; the next Esc ends editing
			// Back to the text as it was; committing it removes a blank line ⌘↩ inserted.
			draft = initial;
			commit();
			endEditing();
		} else if (e.key === 'Enter' && mod) {
			open = false;
			addLineBelow(id, own as EditTarget, draft, e.shiftKey ? 'operation' : 'attribute');
		} else if (e.key === 'Enter') {
			if (open && highlighted()) return; // Bits accepts the suggestion into the draft
			open = false;
			if (own.part === 'name') nameEnter(id, draft);
			else lineEnter(id, own.part, own.index, draft);
		} else if (e.key === 'Tab') {
			open = false;
			moveCompartment(id, own as EditTarget, draft, e.shiftKey);
		} else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && mod && own.part !== 'name') {
			reorderLine(id, own.part, own.index, draft, e.key === 'ArrowUp' ? -1 : 1);
		} else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && open) {
			return; // Bits moves the highlight
		} else return;
		e.preventDefault();
		e.stopPropagation();
	}

	/** Focus left for some other reason (click elsewhere): commit unless a key handler already moved on. */
	function onblur(e: FocusEvent) {
		if (!isCurrent()) return;
		// Focus moving into the completion list is not leaving the editor.
		if (e.relatedTarget instanceof Element && e.relatedTarget.closest('[data-combobox-content]'))
			return;
		commit();
		if (isCurrent()) selection.editing = null;
	}
</script>

{#if completes}
	<Combobox.Root
		type="single"
		items={options}
		bind:open
		onValueChange={(v) => {
			if (v) draft = v;
		}}
		allowDeselect={false}
	>
		<Combobox.Input
			class="line-input nodrag nopan"
			aria-label={ariaLabel}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
			{onkeydown}
			{onblur}
			defaultValue={initial}
			oninput={(e) => {
				draft = e.currentTarget.value;
				open = true;
			}}
			{@attach (node) => focusInput(node as HTMLInputElement).destroy}
		/>
		<Combobox.Portal>
			<Combobox.Content
				class="menu font-mono"
				side="right"
				sideOffset={12}
				align="start"
				aria-label={t('member.types')}
				preventScroll={false}
			>
				<Combobox.Viewport>
					{#each options as option (option.value)}
						<Combobox.Item value={option.value} label={option.value} class="menu-item"
							>{option.label}</Combobox.Item
						>
					{/each}
				</Combobox.Viewport>
			</Combobox.Content>
		</Combobox.Portal>
	</Combobox.Root>
{:else}
	<input
		class="line-input nodrag nopan"
		class:mono={own.part !== 'name'}
		aria-label={ariaLabel}
		{placeholder}
		autocomplete="off"
		spellcheck="false"
		bind:value={draft}
		use:focusInput
		{onkeydown}
		{onblur}
	/>
{/if}

<style>
	/* Board 04: no box of its own; the row band around it marks the open line, a solid ring
	   flush to the edge marks focus. Monospace is for member lines only (ui.md, Type). */
	:global(.line-input) {
		box-sizing: border-box;
		width: 100%;
		min-width: 140px;
		height: 20px;
		padding: 0;
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		border-radius: 0;
	}
	:global(.line-input.mono) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	/* Repeated class: outweighs layout.css's input ring, which uses the chrome accent; on paper
	   the ring must be --paper-accent (blue in high contrast, where the yellow accent fails on white). */
	:global(input.line-input.line-input.line-input:focus-visible) {
		outline: 2px solid var(--paper-accent);
		outline-offset: 0;
	}
	:global(.line-input::placeholder) {
		color: var(--paper-muted);
		opacity: 1;
	}
</style>
