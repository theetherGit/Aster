<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { runCommand } from '#lib/app/commands.svelte.ts';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';
	import Separator from '#lib/ui/atoms/Separator.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import Tip from '#lib/ui/atoms/Tooltip.svelte';

	// The placing tools; Package joins when packages land (M2, DECISIONS.md). Link is not a mode
	// but an action on the one selected node, the same as the L key.
	// The tool glyphs live in Icon.svelte (board 01), drawn at 15 px.
	const TOOLS: { id: Tool; key: string | null }[] = [
		{ id: 'select', key: null },
		{ id: 'class', key: 'C' },
		{ id: 'interface', key: 'I' },
		{ id: 'enum', key: 'E' }
	];
	const label = (tool: (typeof TOOLS)[number]) => {
		const name = t(`ui.tool.${tool.id}`);
		return tool.key ? t('ui.toolKey', { tool: name, key: tool.key }) : name;
	};
	const linkLabel = $derived(t('ui.toolKey', { tool: t('ui.tool.link'), key: 'L' }));
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
		'flex size-(--control-bar) items-center justify-center rounded-control text-chrome-text hover:bg-chrome-surface disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<!-- Tooltips (Tip, Bits): on hover after a delay, at once on focus, so the keys are discoverable
     without a pointer; the native title never reached keyboard users. -->
<Toolbar.Root
	orientation="vertical"
	aria-label={t('ui.toolbox')}
	style="top: calc(var(--space-3) + var(--canvas-inset-top, 0px))"
	class="absolute start-3 z-(--z-toolbox) rounded-menu border border-chrome-border bg-chrome-bg p-1.5 shadow-float"
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
						<Icon name={`tool-${tool.id}`} size={15} />
					</Toolbar.GroupItem>
				{/snippet}
			</Tip>
		{/each}
	</Toolbar.Group>
	<Separator class="mx-1 my-1" />
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
				<Icon name="tool-link" size={15} />
			</Toolbar.Button>
		{/snippet}
	</Tip>
	<!-- The pin is a pressed toggle (Bits Toolbar group, one item) that stays in the arrow-key walk. -->
	<Toolbar.Group
		type="multiple"
		value={pinned ? ['pin'] : []}
		onValueChange={() => runCommand('tool.pin')}
	>
		<Tip text={pinLabel}>
			{#snippet children({ props })}
				<Toolbar.GroupItem
					{...props}
					value="pin"
					aria-label={pinLabel}
					disabled={ui.tool === 'select'}
					class="{BTN} data-[state=on]:bg-accent/15 data-[state=on]:text-accent-text"
				>
					<Icon name="tool-pin" size={15} />
				</Toolbar.GroupItem>
			{/snippet}
		</Tip>
	</Toolbar.Group>
</Toolbar.Root>
