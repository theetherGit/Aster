<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { setElementText } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { NoteFlowNode } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { canvasFocus } from './focus.ts';
	import { edit } from './inline.ts';

	// A note (folded corner, ui.md: 12 px, min 120×60) or a free text element; the same
	// multi-line editor for both. ⌘↩ or leaving the field commits; Esc puts the text back.
	let { id, data, selected }: NodeProps<NoteFlowNode> = $props();
	const el = $derived(data.element);
	const isNote = $derived(el.kind === 'note');
	let draft = $state('');

	function commit() {
		if (draft !== el.text) projectStore.run(setElementText, { id, text: draft });
		if (selection.editing?.id === id) selection.editing = null;
		canvasFocus.focus();
	}
	function cancel() {
		draft = el.text;
		selection.editing = null;
		canvasFocus.focus();
	}
	function onkeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			commit();
		}
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
		return { destroy: () => cancelAnimationFrame(frame) };
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="note-node"
	class:text={!isNote}
	class:selected
	class:link-target={data.link === 'target' || data.link === 'both'}
	class:edge-hover={data.hovered}
	style:min-width="{isNote ? Math.max(120, data.width) : Math.max(60, data.width)}px"
	style:min-height="{isNote ? Math.max(60, data.height) : 0}px"
	data-kind={el.kind}
	ondblclick={(e) => {
		e.stopPropagation();
		edit(id, { part: 'text' });
	}}
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
			onblur={commit}></textarea>
	{:else}
		<p class="body">{el.text || (isNote ? t('note.placeholder') : t('text.placeholder'))}</p>
	{/if}
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
		box-sizing: border-box;
		width: max-content;
		max-width: 420px;
		padding: 6px 10px;
		font-family: var(--font-paper);
		font-size: 12px;
		line-height: 16px;
		color: var(--paper-ink);
		background: var(--paper-fill);
		border: var(--uml-stroke) solid var(--paper-ink);
		/* The folded corner: the top-right 12 px are cut away and drawn back as a triangle. */
		clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
		cursor: grab;
	}
	.note-node.text {
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
			var(--paper-ink) 50%,
			var(--paper-ink) calc(50% + var(--uml-stroke)),
			var(--paper-fill) calc(50% + var(--uml-stroke))
		);
	}
	.note-node:hover:not(.selected),
	.note-node.edge-hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.note-node.selected {
		outline: 2px solid var(--accent);
	}
	.note-node.link-target {
		outline: 2px dashed var(--accent);
		outline-offset: 5px;
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
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border: none;
		outline: none;
		resize: none;
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
		background: var(--accent);
	}
	.note-node:hover :global(.uml-handle) {
		opacity: 1;
	}
	.handle {
		position: absolute;
		box-sizing: border-box;
		width: 7px;
		height: 7px;
		background: var(--paper-bg);
		border: 1.5px solid var(--accent);
	}
	.handle.tl {
		top: -4px;
		left: -4px;
	}
	.handle.tr {
		top: -4px;
		right: -4px;
	}
	.handle.bl {
		bottom: -4px;
		left: -4px;
	}
	.handle.br {
		bottom: -4px;
		right: -4px;
	}
</style>
