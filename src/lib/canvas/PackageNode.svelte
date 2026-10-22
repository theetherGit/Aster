<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { PACKAGE_MIN, replaceElement, resizeNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { flow, type PackageFlowNode } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { canvasFocus } from './focus.ts';
	import { edit } from './inline.ts';
	import { elementSummary } from './summary.ts';

	// A package (M3.1, ui.md): a tab 24 px high and 40 % of the width carrying the name, over the
	// frame its members are drawn in. Sits behind every other node (flow.svelte.ts). F2 or a
	// double-click edits the name; the corner handle resizes, as ⇧+arrows and the inspector do.
	let { id, data, selected }: NodeProps<PackageFlowNode> = $props();
	const pkg = $derived(data.pkg);
	let draft = $state('');
	let live: { w: number; h: number } | null = $state(null);
	const size = $derived(live ?? { w: data.width, h: data.height });
	const summary = $derived(
		elementSummary(projectStore.project, projectStore.diagram, id, { index: flow.relIndex })
	);

	function commit(refocus: boolean) {
		const name = draft.trim();
		if (name && name !== pkg.name)
			projectStore.run(replaceElement, { element: { ...$state.snapshot(pkg), name } });
		if (selection.editing?.id === id) selection.editing = null;
		if (refocus) canvasFocus.focus();
	}
	function onkeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod && !e.altKey) e.stopPropagation();
		if (e.key === 'Escape') {
			selection.editing = null;
			canvasFocus.focus();
		} else if (e.key === 'Enter') commit(true);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
	// A new node is hidden until Svelte Flow has measured it: keep trying for a few frames.
	function focusField(node: HTMLInputElement) {
		draft = pkg.name;
		let frame = 0;
		let tries = 0;
		const attempt = () => {
			node.focus();
			node.select();
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
	/** The corner handle: the new size follows the pointer, one resizeNode when it is let go. */
	function resize(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		const start = { x: e.clientX, y: e.clientY, ...size };
		const move = (ev: PointerEvent) => {
			const z = ui.zoom || 1;
			live = {
				w: Math.max(PACKAGE_MIN.w, Math.round(start.w + (ev.clientX - start.x) / z)),
				h: Math.max(PACKAGE_MIN.h, Math.round(start.h + (ev.clientY - start.y) / z))
			};
		};
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			if (live && (live.w !== data.width || live.h !== data.height))
				projectStore.run(resizeNode, { diagramId: projectStore.activeDiagramId, id, ...live });
			live = null;
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="package-node uml-paint"
	role="group"
	aria-label={summary}
	tabindex={data.focus === 'self' ? 0 : -1}
	data-focus-id={id}
	data-part="self"
	data-name={pkg.name}
	class:selected
	class:edge-hover={data.hovered}
	style:width="{size.w}px"
	style:height="{size.h}px"
	style:--fill={data.fill}
	style:--line={data.line}
	ondblclick={(e) => {
		e.stopPropagation();
		edit(id, { part: 'name' });
	}}
>
	<div class="tab">
		{#if data.editing}
			<input
				class="name-input nodrag nopan"
				aria-label={t('package.name')}
				bind:value={draft}
				use:focusField
				{onkeydown}
				onblur={() => commit(false)}
			/>
		{:else}
			<span class="name">{pkg.name}</span>
		{/if}
	</div>
	<div class="frame"></div>
	{#each [Position.Top, Position.Right, Position.Bottom, Position.Left] as pos (pos)}
		<Handle type="source" id={pos[0]} position={pos} class="uml-handle" isConnectable={false} />
	{/each}
	{#if selected}
		<span class="handle tl"></span><span class="handle tr"></span>
		<span class="handle bl"></span>
		<!-- 24 px target around the 6 px corner (CLAUDE.md rule 4); ⇧+arrows are the keyboard path. -->
		<span class="nodrag nopan resize" aria-hidden="true" onpointerdown={resize}
			><span class="handle br"></span></span
		>
	{/if}
</div>

<style>
	/* ui.md: tab 24 px high and 40 % of the width; min 240 × 160. */
	.package-node {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		font-family: var(--font-paper);
		font-size: 13px;
		color: var(--paper-ink);
		cursor: grab;
	}
	.tab {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: 40%;
		min-width: 80px;
		height: 24px;
		padding: 0 8px;
		background: var(--fill, var(--paper-fill));
		border: var(--uml-stroke) solid var(--line, var(--paper-ink));
		border-bottom: none;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.frame {
		flex: 1;
		background: var(--fill, var(--paper-fill));
		border: var(--uml-stroke) solid var(--line, var(--paper-ink));
	}
	.name-input {
		box-sizing: border-box;
		width: 100%;
		height: 20px;
		padding: 0 4px;
		font: inherit;
		color: inherit;
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
		border: none;
	}
	.name-input:focus-visible {
		outline: 2px solid var(--paper-accent);
		outline-offset: 0;
	}
	.package-node:hover:not(.selected) .frame,
	.package-node.edge-hover:not(.selected) .frame {
		outline: 1px solid color-mix(in srgb, var(--paper-accent) 50%, transparent);
	}
	.package-node.selected {
		outline: 2px solid var(--paper-accent);
	}
	.package-node:not(.selected):focus-visible {
		outline: none;
	}
	.package-node:focus-visible::after {
		content: '';
		position: absolute;
		inset: -7px;
		border: 2px dashed var(--paper-accent);
		pointer-events: none;
	}
	/* Packages take no lines here (UML package dependencies are v0.2): the handles never show. */
	.package-node :global(.uml-handle) {
		visibility: hidden;
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
		top: 21px;
		right: -3px;
	}
	.handle.bl {
		bottom: -3px;
		left: -3px;
	}
	.resize {
		position: absolute;
		right: -12px;
		bottom: -12px;
		width: 24px;
		height: 24px;
		cursor: nwse-resize;
	}
	.resize .handle.br {
		top: 9px;
		left: 9px;
	}
</style>
