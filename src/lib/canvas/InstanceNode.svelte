<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { replaceElement } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { instanceFromText, instanceLabel, instanceText } from '#lib/model/project.ts';
	import { flow, type InstanceFlowNode } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { canvasFocus } from './focus.ts';
	import { edit } from './inline.ts';
	import { elementSummary } from './summary.ts';

	// An object (M3.2), as StarUML draws one: the underlined "name: Class" over its slots. One
	// multi-line editor, as a note has: the label on the first line, a slot per line after it.
	// ⌘↩ or leaving the field commits; Esc puts the text back.
	let { id, data, selected }: NodeProps<InstanceFlowNode> = $props();
	const o = $derived(data.instance);
	let draft = $state('');
	const summary = $derived(
		elementSummary(projectStore.project, projectStore.diagram, id, { index: flow.relIndex })
	);

	function commit(refocus: boolean) {
		// Node data reaches the component through Svelte Flow's state: a plain copy to edit.
		const next = instanceFromText($state.snapshot(o) as typeof o, draft);
		if (JSON.stringify(next) !== JSON.stringify(o))
			projectStore.run(replaceElement, { element: next });
		if (selection.editing?.id === id) selection.editing = null;
		if (refocus) canvasFocus.focus();
	}
	function cancel() {
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
		draft = instanceText(o);
		// The name is what a new object is made for: it starts selected.
		const head = draft.indexOf(':') < 0 ? draft.split('\n')[0].length : draft.indexOf(':');
		let frame = 0;
		let tries = 0;
		const attempt = () => {
			node.focus();
			node.setSelectionRange(0, head);
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="instance-node uml-paint"
	role="group"
	aria-label={summary}
	tabindex={data.focus === 'self' ? 0 : -1}
	data-focus-id={id}
	data-part="self"
	class:selected
	class:link-target={data.link === 'target' || data.link === 'both'}
	class:edge-hover={data.hovered}
	style:min-width="{Math.max(120, data.width)}px"
	style:--fill={data.fill}
	style:--line={data.line}
	data-name={o.name}
	ondblclick={(e) => {
		e.stopPropagation();
		edit(id, { part: 'text' });
	}}
>
	{#if data.editing}
		<textarea
			class="editor nodrag nopan"
			aria-label={t('object.text')}
			rows={Math.max(2, o.slots.length + 2)}
			bind:value={draft}
			use:focusArea
			{onkeydown}
			onblur={() => commit(false)}></textarea>
	{:else}
		<div class="name-row">
			{#if o.stereotype}<span class="stereotype">«{o.stereotype}»</span>{/if}
			<span class="name">{instanceLabel(o) || t('object.anonymous')}</span>
		</div>
		<div class="slots">
			{#each o.slots as s (s.id)}
				<div class="slot">{s.value ? `${s.name} = ${s.value}` : s.name}</div>
			{/each}
		</div>
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
	/* ui.md's class metrics: a 28 px name row, 20 px slot rows, a collapsed 8 px empty compartment. */
	.instance-node {
		position: relative;
		box-sizing: border-box;
		width: max-content;
		background: var(--fill, var(--paper-fill));
		color: var(--paper-ink);
		border: var(--uml-stroke) solid var(--line, var(--paper-ink));
		font-family: var(--font-paper);
		font-size: 12px;
		line-height: 20px;
		white-space: nowrap;
		cursor: grab;
	}
	.instance-node:hover:not(.selected),
	.instance-node.edge-hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--paper-accent) 50%, transparent);
	}
	.instance-node.selected {
		outline: 2px solid var(--paper-accent);
	}
	.instance-node.link-target {
		outline: 2px dashed var(--paper-accent);
		outline-offset: 5px;
	}
	.instance-node:not(.selected):focus-visible {
		outline: none;
	}
	.instance-node:focus-visible::after {
		content: '';
		position: absolute;
		inset: -7px;
		border: 2px dashed var(--paper-accent);
		pointer-events: none;
	}
	.name-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 28px;
		padding: 0 10px;
		font-size: 13px;
		font-weight: 600;
	}
	.stereotype {
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	}
	.name {
		line-height: 18px;
		text-decoration: underline;
	}
	.slots {
		min-height: 8px;
		padding: 0 10px;
		border-top: 1px solid var(--line, var(--paper-ink));
	}
	.slots:not(:empty) {
		padding-block: 6px;
	}
	.editor {
		box-sizing: border-box;
		display: block;
		width: 100%;
		min-width: 160px;
		padding: 4px 10px;
		font: inherit;
		color: inherit;
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
		border: none;
		resize: none;
	}
	.editor:focus-visible {
		outline: 2px solid var(--paper-accent);
		outline-offset: 0;
	}
	.instance-node :global(.uml-handle) {
		width: 24px;
		height: 24px;
		min-width: 0;
		min-height: 0;
		background: transparent;
		border: none;
		opacity: 0;
	}
	.instance-node :global(.uml-handle::after) {
		content: '';
		position: absolute;
		inset: 8px;
		border-radius: 50%;
		background: var(--paper-accent);
	}
	.instance-node:hover :global(.uml-handle) {
		opacity: 1;
	}
	.instance-node :global(.uml-handle.svelte-flow__handle-top) {
		transform: translate(-50%, -100%);
	}
	.instance-node :global(.uml-handle.svelte-flow__handle-bottom) {
		transform: translate(-50%, 100%);
	}
	.instance-node :global(.uml-handle.svelte-flow__handle-left) {
		transform: translate(-100%, -50%);
	}
	.instance-node :global(.uml-handle.svelte-flow__handle-right) {
		transform: translate(100%, -50%);
	}
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
