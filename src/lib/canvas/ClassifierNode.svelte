<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { t } from '#lib/i18n/index.ts';
	import { membersOf } from '#lib/commands/index.ts';
	import { flow, type ClassifierFlowNode } from '#lib/stores/flow.svelte.ts';
	import { namespaceOf } from '#lib/model/project.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Compartment from './Compartment.svelte';
	import LineEditor from './LineEditor.svelte';
	import { compartmentsFor, edit, headerLabel } from './inline.ts';
	import { elementSummary } from './summary.ts';

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
	// stereotypeDisplay 'none' (⌘⇧0) hides the «stereotype» line; 'label' is the default.
	const header = $derived(flags.stereotypeDisplay === 'none' ? undefined : headerLabel(c));
	// ⌘⇧N: "(from A::B)" under the name, as StarUML's namespace label reads (M3.1).
	const namespace = $derived(
		flags.showNamespace ? namespaceOf(projectStore.project, c) : undefined
	);
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
	// Roving focus (accessibility.md): the node, its name and each line are parts; the one that
	// owns focus is the diagram's single tabindex="0". `data-focus-id` + `data-part` find it again
	// after any re-render, so focus is never lost.
	const focusedIndex = (kind: (typeof compartments)[number]) => {
		const m = data.focus && /^(\w+):(\d+)$/.exec(data.focus);
		return m && m[1] === kind ? Number(m[2]) : null;
	};
	const summary = $derived(
		elementSummary(projectStore.project, projectStore.diagram, id, { index: flow.relIndex })
	);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="classifier-node uml-paint"
	role="group"
	aria-label={summary}
	tabindex={data.focus === 'self' ? 0 : -1}
	data-focus-id={id}
	data-part="self"
	class:selected
	class:link-target={data.link === 'target' || data.link === 'both'}
	class:edge-hover={data.hovered}
	class:wrap={flags.wordWrap}
	style:min-width="{data.minWidth}px"
	style:width={flags.wordWrap ? `${data.minWidth}px` : undefined}
	style:min-height={data.minHeight ? `${data.minHeight}px` : undefined}
	style:--fill={data.fill}
	style:--line={data.line}
	data-name={c.name}
	data-kind={c.classifierKind}
>
	<!-- Double-click is a pointer shortcut only; F2 / ↩ on the selected node is the keyboard path. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="name-row"
		class:with-stereotype={header}
		class:with-namespace={namespace}
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
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				class="name"
				class:abstract={c.isAbstract}
				tabindex={data.focus === 'name' ? 0 : -1}
				data-focus-id={id}
				data-part="name">{c.name}</span
			>
		{/if}
		{#if namespace}<span class="namespace">{t('node.from', { namespace })}</span>{/if}
	</div>
	{#each compartments as kind (kind)}
		<Compartment
			classifierId={id}
			{kind}
			members={membersOf(c, kind)}
			{flags}
			editing={editingIndex(kind)}
			focused={focusedIndex(kind)}
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
		/* The view's own colours (paint.ts) over the paper's; layout.css drops them in high contrast. */
		background: var(--fill, var(--paper-fill));
		color: var(--paper-ink);
		border: var(--uml-stroke) solid var(--line, var(--paper-ink));
		font-family: var(--font-paper);
		font-size: 12px;
		line-height: 20px;
		white-space: nowrap;
		cursor: grab;
	}
	.classifier-node:hover:not(.selected),
	.classifier-node.edge-hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--paper-accent) 50%, transparent);
	}
	.classifier-node.selected {
		outline: 2px solid var(--paper-accent);
	}
	/* Keyboard focus: a 2 px dashed accent ring at 5 px offset (ui.md), drawn as a pseudo-element
	   so it shows beside the solid selection outline on the same node. */
	.classifier-node:focus-visible {
		outline: 2px solid var(--paper-accent);
	}
	.classifier-node:not(.selected):focus-visible {
		outline: none;
	}
	.classifier-node:focus-visible::after {
		content: '';
		position: absolute;
		inset: -7px;
		border: 2px dashed var(--paper-accent);
		pointer-events: none;
	}
	.name:focus-visible,
	.classifier-node :global(.member:focus-visible) {
		outline: 2px dashed var(--paper-accent);
		outline-offset: 1px;
	}
	/* The keyboard link target carries the focus-ring style (ui.md). */
	.classifier-node.link-target {
		outline: 2px dashed var(--paper-accent);
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
	/* A hollow ring: the link handle, distinct from the solid square selection handles. */
	.classifier-node :global(.uml-handle::after) {
		content: '';
		position: absolute;
		inset: 7px;
		box-sizing: border-box;
		border: 2px solid var(--paper-accent);
		border-radius: 50%;
		background: var(--paper-bg);
	}
	.classifier-node:hover :global(.uml-handle) {
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
	.name-row.with-namespace {
		height: 44px;
	}
	.name-row.with-stereotype.with-namespace {
		height: 56px;
	}
	/* Word wrap (StarUML's wordWrap): the stored width holds, text wraps, rows grow (M3 sweep). */
	.classifier-node.wrap {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.classifier-node.wrap .name-row {
		height: auto;
		min-height: 28px;
		padding-block: 5px;
		text-align: center;
	}
	.classifier-node.wrap :global(.member) {
		height: auto;
		min-height: 20px;
	}
	.namespace {
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
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
		padding: 0 4px;
		text-align: center;
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
	}
	/* Board 01/13, ui.md: hollow 6 px corner handles, centred on the corners. */
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
