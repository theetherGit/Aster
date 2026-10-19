<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { runCommand } from '#lib/app/commands.svelte.ts';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';
	import Tip from './Tip.svelte';

	// The placing tools; Package joins when packages land (M2, DECISIONS.md). Link is not a mode
	// but an action on the one selected node, the same as the L key.
	// Icons from the board (docs/design/html/01): 24-unit paths drawn at 15 px.
	const RECT = 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z';
	const TOOLS: { id: Tool; key: string | null; paths: string[] }[] = [
		{ id: 'select', key: null, paths: ['M5 3l14 8-6 2-3 6z'] },
		{ id: 'class', key: 'C', paths: [RECT, 'M4 10h16M4 15h16'] },
		{ id: 'interface', key: 'I', paths: ['M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z'] },
		{ id: 'enum', key: 'E', paths: [RECT, 'M4 10h16M8 14h2M8 17h2M12 14h4M12 17h4'] }
	];
	const LINK = ['M5 19L19 5', 'M12 5h7v7'];
	const PIN = ['M12 17v5', 'M9 3h6l-1 7 3 3H7l3-3z'];
	const label = (tool: (typeof TOOLS)[number]) => {
		const name = t(`ui.tool.${tool.id}`);
		return tool.key ? t('ui.toolKey', { tool: name, key: tool.key }) : name;
	};
	const linkLabel = t('ui.toolKey', { tool: t('ui.tool.link'), key: 'L' });
	// The same test as the L key: one selected element, and it is a node (an edge has no handles).
	const canLink = $derived(
		selection.size === 1 && projectStore.diagram.layout.get(selection.list[0])?.kind === 'node'
	);
	const pinned = $derived(ui.pinned !== null && ui.pinned === ui.tool);
	const pinLabel = $derived(
		ui.tool === 'select'
			? t('ui.pinNothing')
			: t(pinned ? 'ui.unpin' : 'ui.pin', { tool: t(`ui.tool.${ui.tool}`) })
	);
	const BTN =
		'flex h-8 w-8 items-center justify-center rounded-control text-chrome-text hover:bg-chrome-surface disabled:opacity-40 disabled:hover:bg-transparent';
</script>

{#snippet icon(paths: string[])}
	<svg
		width="15"
		height="15"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#each paths as d (d)}<path {d} />{/each}
	</svg>
{/snippet}

<!-- Tooltips (Tip, Bits): on hover after a delay, at once on focus, so the keys are discoverable
     without a pointer; the native title never reached keyboard users. -->
<Toolbar.Root
	orientation="vertical"
	aria-label={t('ui.toolbox')}
	style="top: calc(12px + var(--canvas-inset-top, 0px))"
	class="absolute left-3 z-10 rounded-[10px] border border-chrome-border bg-chrome-bg p-1.5 shadow-lg"
>
	<Toolbar.Group
		type="single"
		value={ui.tool}
		onValueChange={(v: string) => {
			ui.tool = (v || 'select') as Tool;
			if (ui.pinned && ui.pinned !== ui.tool) ui.pinned = null;
		}}
		class="flex flex-col gap-1"
	>
		{#each TOOLS as tool (tool.id)}
			<Tip text={t(`ui.tool.${tool.id}`)} key={tool.key ?? undefined}>
				{#snippet children({ props })}
					<Toolbar.GroupItem
						{...props}
						value={tool.id}
						aria-label={ui.pinned === tool.id
							? t('ui.toolPinned', { tool: label(tool) })
							: label(tool)}
						data-pinned={ui.pinned === tool.id || undefined}
						ondblclick={() => tool.id !== 'select' && ((ui.tool = tool.id), (ui.pinned = tool.id))}
						class="{BTN} font-semibold data-pinned:ring-2 data-pinned:ring-accent data-pinned:ring-inset data-[state=on]:bg-accent/15 data-[state=on]:text-accent-text"
					>
						{@render icon(tool.paths)}
					</Toolbar.GroupItem>
				{/snippet}
			</Tip>
		{/each}
	</Toolbar.Group>
	<span class="mx-1 my-1 block h-px bg-chrome-border" aria-hidden="true"></span>
	<Tip text={canLink ? t('ui.tool.link') : t('ui.linkHint')} key={canLink ? 'L' : undefined}>
		{#snippet children({ props })}
			<Toolbar.Button
				{...props}
				aria-label={linkLabel}
				disabled={!canLink}
				onclick={() => {
					// Focus moves to the canvas so the arrows, ↩ and Esc of the link work at once.
					if (canvasApi.startLink()) canvasFocus.focus();
				}}
				class={BTN}
			>
				{@render icon(LINK)}
			</Toolbar.Button>
		{/snippet}
	</Tip>
	<Tip text={pinLabel}>
		{#snippet children({ props })}
			<Toolbar.Button
				{...props}
				aria-label={pinLabel}
				aria-pressed={pinned}
				disabled={ui.tool === 'select'}
				onclick={() => runCommand('tool.pin')}
				class="{BTN} aria-pressed:bg-accent/15 aria-pressed:text-accent-text"
			>
				{@render icon(PIN)}
			</Toolbar.Button>
		{/snippet}
	</Tip>
</Toolbar.Root>
