<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { t } from '#lib/i18n/index.ts';
	import { membersOf } from '#lib/commands/index.ts';
	import type { ClassifierFlowNode } from '#lib/stores/flow.svelte.ts';
	import Compartment from './Compartment.svelte';
	import LineEditor from './LineEditor.svelte';
	import { compartmentsFor, edit, headerLabel } from './inline.ts';

	let { id, data, selected }: NodeProps<ClassifierFlowNode> = $props();

	// Drag from a side handle to another node to connect (L is the keyboard path).
	const HANDLES = [
		{ id: 't', position: Position.Top },
		{ id: 'r', position: Position.Right },
		{ id: 'b', position: Position.Bottom },
		{ id: 'l', position: Position.Left }
	];

	const c = $derived(data.classifier);
	const flags = $derived(data.flags);
	const header = $derived(headerLabel(c));
	const compartments = $derived(
		compartmentsFor(c).filter(
			(k) =>
				!(k === 'attribute' && flags.suppressAttributes) &&
				!(k === 'operation' && flags.suppressOperations) &&
				!(k === 'literal' && flags.suppressLiterals)
		)
	);
	const editingIndex = (kind: (typeof compartments)[number]) =>
		data.editing && data.editing.part === kind ? data.editing.index : null;
</script>

<div
	class="classifier-node"
	class:selected
	class:link-target={data.link === 'target' || data.link === 'both'}
	style:min-width="{data.minWidth}px"
	data-name={c.name}
	data-kind={c.classifierKind}
>
	<!-- Double-click is a pointer shortcut only; F2 / ↩ on the selected node is the keyboard path. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="name-row"
		class:with-stereotype={header}
		ondblclick={(e) => {
			e.stopPropagation();
			edit(id, { part: 'name' });
		}}
	>
		{#if header}<span class="stereotype">«{header}»</span>{/if}
		{#if data.editing?.part === 'name'}
			<LineEditor
				{id}
				target={{ part: 'name' }}
				initial={c.name}
				label={t('ui.className')}
				selectAll
			/>
		{:else}
			<span class="name" class:abstract={c.isAbstract}>{c.name}</span>
		{/if}
	</div>
	{#each compartments as kind (kind)}
		<Compartment
			classifierId={id}
			{kind}
			members={membersOf(c, kind)}
			{flags}
			editing={editingIndex(kind)}
		/>
	{/each}
	{#each HANDLES as h (h.id)}
		<Handle type="source" id={h.id} position={h.position} class="uml-handle" />
	{/each}
	{#if selected}
		<span class="handle tl"></span><span class="handle tr"></span>
		<span class="handle bl"></span><span class="handle br"></span>
	{/if}
</div>

<style>
	/* Metrics and tokens from docs/spec/ui.md: strict UML on white paper regardless of theme. */
	.classifier-node {
		position: relative;
		box-sizing: border-box;
		min-width: 160px;
		width: max-content;
		background: var(--paper-fill);
		color: var(--paper-ink);
		border: 1px solid var(--paper-ink);
		font-family: var(--font-paper);
		font-size: 12px;
		line-height: 20px;
		white-space: nowrap;
		cursor: grab;
	}
	.classifier-node:hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.classifier-node.selected {
		outline: 2px solid var(--accent);
	}
	/* The keyboard link target carries the focus-ring style (ui.md). */
	.classifier-node.link-target {
		outline: 2px dashed var(--accent);
		outline-offset: 5px;
	}
	/* 24 px handles just outside each side; the dot shows on hover. */
	.classifier-node :global(.uml-handle) {
		width: 24px;
		height: 24px;
		min-width: 0;
		min-height: 0;
		background: transparent;
		border: none;
		border-radius: 50%;
		opacity: 0;
	}
	.classifier-node :global(.uml-handle::after) {
		content: '';
		position: absolute;
		inset: 8px;
		border-radius: 50%;
		background: var(--accent);
	}
	.classifier-node:hover :global(.uml-handle),
	.classifier-node.selected :global(.uml-handle) {
		opacity: 1;
	}
	.classifier-node :global(.uml-handle.svelte-flow__handle-top) {
		transform: translate(-50%, -100%);
	}
	.classifier-node :global(.uml-handle.svelte-flow__handle-bottom) {
		transform: translate(-50%, 100%);
	}
	.classifier-node :global(.uml-handle.svelte-flow__handle-left) {
		transform: translate(-100%, -50%);
	}
	.classifier-node :global(.uml-handle.svelte-flow__handle-right) {
		transform: translate(100%, -50%);
	}
	.name-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 28px;
		padding: 0 10px;
		font-size: 13px;
		font-weight: 600;
	}
	.name-row.with-stereotype {
		height: 40px;
	}
	.stereotype {
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	}
	.name {
		line-height: 18px;
	}
	.name.abstract {
		font-style: italic;
	}
	.name-row :global(.line-input) {
		height: 22px;
		text-align: center;
	}
	.handle {
		position: absolute;
		width: 6px;
		height: 6px;
		background: var(--accent);
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
