<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { setElementText } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { NoteFlowNode } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { canvasFocus } from './focus.ts';
	import { edit } from './inline.ts';
	import { elementSummary } from './summary.ts';

	// A note (folded corner, ui.md: 12 px, min 120×60) or a free text element; the same
	// multi-line editor for both. ⌘↩ or leaving the field commits; Esc puts the text back.
	// Only the keys that end editing return focus to the canvas: a blur went somewhere on purpose.
	let { id, data, selected }: NodeProps<NoteFlowNode> = $props();
	const el = $derived(data.element);
	const isNote = $derived(el.kind === 'note');
	let draft = $state('');
	const summary = $derived(elementSummary(projectStore.project, projectStore.diagram, id));

	function commit(refocus: boolean) {
		if (draft !== el.text) projectStore.run(setElementText, { id, text: draft });
		if (selection.editing?.id === id) selection.editing = null;
		if (refocus) canvasFocus.focus();
	}
	function cancel() {
		draft = el.text;
		selection.editing = null;
		canvasFocus.focus();
	}
	// Esc and ⌘↩ are the editor's; every other chord goes on to the window handler (⌘S, ⌘Z …).
	function onkeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod && !e.altKey) e.stopPropagation();
		if (e.key === 'Escape') cancel();
		else if (e.key === 'Enter' && mod) commit(true);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
	function focusArea(node: HTMLTextAreaElement) {
		draft = el.text;
		let frame = 0;
		let tries = 0;
		const attempt = () => {
			node.focus();
			node.setSelectionRange(node.value.length, node.value.length);
			if (document.activeElement !== node && tries++ < 30) frame = requestAnimationFrame(attempt);
		};
		attempt();
		return {
			destroy: () => {
				cancelAnimationFrame(frame);
				queueMicrotask(() => {
					if (document.activeElement === document.body) canvasFocus.focus();
				});
			}
		};
	}
</script>

<!-- The outer box is never clipped, so the selection, hover and link-target outlines and the
     corner handles draw whole; the sheet inside carries the fill, the border and the folded corner. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="note-node uml-paint"
	role="group"
	aria-label={summary}
	tabindex={data.focus === 'self' ? 0 : -1}
	data-focus-id={id}
	data-part="self"
	class:text={!isNote}
	class:selected
	class:link-target={data.link === 'target' || data.link === 'both'}
	class:edge-hover={data.hovered}
	style:--fill={isNote ? data.fill : undefined}
	style:--line={isNote ? data.line : undefined}
	data-kind={el.kind}
	ondblclick={(e) => {
		e.stopPropagation();
		edit(id, { part: 'text' });
	}}
>
	<div
		class="sheet"
		style:min-width="{isNote ? Math.max(120, data.width) : Math.max(60, data.width)}px"
		style:min-height="{isNote ? Math.max(60, data.height) : 0}px"
	>
		{#if isNote}<span class="fold" aria-hidden="true"></span>{/if}
		{#if data.editing}
			<textarea
				class="editor nodrag nopan"
				aria-label={isNote ? t('note.text') : t('text.text')}
				placeholder={isNote ? t('note.placeholder') : t('text.placeholder')}
				bind:value={draft}
				use:focusArea
				{onkeydown}
				onblur={() => commit(false)}></textarea>
		{:else}
			<p class="body">{el.text || (isNote ? t('note.placeholder') : t('text.placeholder'))}</p>
		{/if}
	</div>
	{#each [Position.Top, Position.Right, Position.Bottom, Position.Left] as pos (pos)}
		<Handle type="source" id={pos[0]} position={pos} class="uml-handle" />
	{/each}
	{#if selected}
		<span class="handle tl"></span><span class="handle tr"></span>
		<span class="handle bl"></span><span class="handle br"></span>
	{/if}
</div>

<style>
	.note-node {
		position: relative;
		width: max-content;
		max-width: 420px;
		font-family: var(--font-paper);
		font-size: 12px;
		line-height: 16px;
		color: var(--paper-ink);
		cursor: grab;
	}
	.sheet {
		position: relative;
		box-sizing: border-box;
		max-width: 420px;
		padding: 6px 10px;
		background: var(--fill, var(--paper-fill));
		border: var(--uml-stroke) solid var(--line, var(--paper-ink));
		/* The folded corner: the top-right 12 px are cut away and drawn back as a triangle. */
		clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
	}
	.note-node.text .sheet {
		border-color: transparent;
		background: transparent;
		clip-path: none;
	}
	.fold {
		position: absolute;
		top: 0;
		right: 0;
		width: 12px;
		height: 12px;
		background: linear-gradient(
			225deg,
			transparent 50%,
			var(--line, var(--paper-ink)) 50%,
			var(--line, var(--paper-ink)) calc(50% + var(--uml-stroke)),
			var(--fill, var(--paper-fill)) calc(50% + var(--uml-stroke))
		);
	}
	.note-node:hover:not(.selected),
	.note-node.edge-hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--paper-accent) 50%, transparent);
	}
	.note-node.selected {
		outline: 2px solid var(--paper-accent);
	}
	.note-node.link-target {
		outline: 2px dashed var(--paper-accent);
		outline-offset: 5px;
	}
	/* Keyboard focus ring beside the solid selection outline, as on classifiers. */
	.note-node:not(.selected):focus-visible {
		outline: none;
	}
	.note-node:focus-visible::after {
		content: '';
		position: absolute;
		inset: -7px;
		border: 2px dashed var(--paper-accent);
		pointer-events: none;
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
	}
	.body:empty::before {
		content: ' ';
	}
	.editor {
		box-sizing: border-box;
		display: block;
		width: 100%;
		min-width: 100px;
		min-height: 44px;
		padding: 0;
		font: inherit;
		color: inherit;
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
		border: none;
		resize: none;
	}
	.editor::placeholder {
		color: var(--paper-muted);
		opacity: 1;
	}
	.editor:focus-visible {
		outline: 2px solid var(--paper-accent);
		outline-offset: 0;
	}
	.note-node :global(.uml-handle) {
		width: 24px;
		height: 24px;
		min-width: 0;
		min-height: 0;
		background: transparent;
		border: none;
		opacity: 0;
	}
	.note-node :global(.uml-handle::after) {
		content: '';
		position: absolute;
		inset: 8px;
		border-radius: 50%;
		background: var(--paper-accent);
	}
	.note-node:hover :global(.uml-handle) {
		opacity: 1;
	}
	/* ui.md: 6 px hollow corner handles, the same as a class's; notes do not resize yet (M2). */
	.handle {
		position: absolute;
		box-sizing: border-box;
		width: 6px;
		height: 6px;
		background: var(--paper-bg);
		border: 1.5px solid var(--paper-accent);
	}
	.handle.tl {
		top: -3px;
		left: -3px;
	}
	.handle.tr {
		top: -3px;
		right: -3px;
	}
	.handle.bl {
		bottom: -3px;
		left: -3px;
	}
	.handle.br {
		bottom: -3px;
		right: -3px;
	}
</style>
