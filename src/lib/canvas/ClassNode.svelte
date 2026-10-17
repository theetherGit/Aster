<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { renameClassifier } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { renderAttribute, renderOperation } from '#lib/model/render.ts';
	import type { ClassFlowNode } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { canvasFocus } from './focus.ts';

	let { id, data, selected }: NodeProps<ClassFlowNode> = $props();

	const c = $derived(data.classifier);
	const flags = $derived(data.flags);

	let draft = $state('');

	// Svelte Flow keeps a fresh node hidden until it has measured it, and a hidden input
	// cannot take focus, so retry for a few frames until focus sticks.
	function focusSelect(node: HTMLInputElement) {
		draft = c.name;
		let frame = 0;
		let tries = 0;
		const attempt = () => {
			node.focus();
			node.select();
			if (document.activeElement !== node && tries++ < 30) frame = requestAnimationFrame(attempt);
		};
		attempt();
		return { destroy: () => cancelAnimationFrame(frame) };
	}
	function end() {
		if (selection.editingId === id) selection.editingId = null;
		canvasFocus.focus();
	}
	function commit() {
		const name = draft.trim();
		if (name && name !== c.name) projectStore.run(renameClassifier, { id, name });
		end();
	}
	function onkeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			draft = c.name;
			end();
		}
	}
</script>

<div class="class-node" class:selected style:min-width="{data.minWidth}px" data-name={c.name}>
	<div class="name-row" class:with-stereotype={c.stereotype}>
		{#if c.stereotype}<span class="stereotype">«{c.stereotype}»</span>{/if}
		{#if data.editing}
			<input
				class="name-input nodrag nopan"
				aria-label={t('ui.className')}
				bind:value={draft}
				use:focusSelect
				{onkeydown}
				onblur={commit}
			/>
		{:else}
			<span class="name" class:abstract={c.isAbstract}>{c.name}</span>
		{/if}
	</div>
	{#if !flags.suppressAttributes}
		<ul class="compartment" class:empty={c.attributes.length === 0} data-compartment="attributes">
			{#each c.attributes as a (a.id)}
				<li class="member" class:static={a.isStatic}>{renderAttribute(a, flags)}</li>
			{/each}
		</ul>
	{/if}
	{#if !flags.suppressOperations}
		<ul class="compartment" class:empty={c.operations.length === 0} data-compartment="operations">
			{#each c.operations as o (o.id)}
				<li class="member" class:static={o.isStatic}>{renderOperation(o, flags)}</li>
			{/each}
		</ul>
	{/if}
	{#if selected}
		<span class="handle tl"></span><span class="handle tr"></span>
		<span class="handle bl"></span><span class="handle br"></span>
	{/if}
</div>

<style>
	/* Metrics and tokens from docs/spec/ui.md: strict UML on white paper regardless of theme. */
	.class-node {
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
	.class-node:hover:not(.selected) {
		outline: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.class-node.selected {
		outline: 2px solid var(--accent);
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
	.name-input {
		box-sizing: border-box;
		width: 100%;
		min-width: 120px;
		height: 24px;
		padding: 0 4px;
		font: inherit;
		color: inherit;
		text-align: center;
		background: var(--paper-fill);
		border: 1px solid var(--accent);
		border-radius: 2px;
	}
	.compartment {
		margin: 0;
		padding: 6px 10px;
		list-style: none;
		border-top: 1px solid var(--paper-ink);
	}
	.compartment.empty {
		height: 8px;
		padding: 0;
	}
	.member {
		height: 20px;
	}
	.member.static {
		text-decoration: underline;
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
