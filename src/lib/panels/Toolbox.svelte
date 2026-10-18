<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { t } from '#lib/i18n/index.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';

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
	const label = (tool: (typeof TOOLS)[number]) => {
		const name = t(`ui.tool.${tool.id}`);
		return tool.key ? t('ui.toolKey', { tool: name, key: tool.key }) : name;
	};
	const linkLabel = t('ui.toolKey', { tool: t('ui.tool.link'), key: 'L' });
	const canLink = $derived(selection.size === 1);
</script>

<Toolbar.Root
	orientation="vertical"
	aria-label={t('ui.toolbox')}
	style="top: calc(12px + var(--canvas-inset-top, 0px))"
	class="absolute left-3 z-10 rounded-[10px] border border-chrome-border bg-chrome-bg p-1.5 shadow-lg"
>
	<Toolbar.Group
		type="single"
		value={ui.tool}
		onValueChange={(v: string) => (ui.tool = (v || 'select') as Tool)}
		class="flex flex-col gap-1"
	>
		{#each TOOLS as tool (tool.id)}
			<Toolbar.GroupItem
				value={tool.id}
				aria-label={label(tool)}
				title={label(tool)}
				class="flex h-8 w-8 items-center justify-center rounded-control text-[13px] font-semibold text-chrome-text hover:bg-chrome-surface data-[state=on]:bg-accent/15 data-[state=on]:text-accent"
			>
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
					{#each tool.paths as d (d)}<path {d} />{/each}
				</svg>
			</Toolbar.GroupItem>
		{/each}
	</Toolbar.Group>
	<span class="mx-1 my-1 block h-px bg-chrome-border" aria-hidden="true"></span>
	<Toolbar.Button
		aria-label={linkLabel}
		title={canLink ? linkLabel : t('ui.linkHint')}
		disabled={!canLink}
		onclick={() => canvasApi.startLink()}
		class="flex h-8 w-8 items-center justify-center rounded-control text-chrome-text hover:bg-chrome-surface disabled:opacity-40 disabled:hover:bg-transparent"
	>
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
			{#each LINK as d (d)}<path {d} />{/each}
		</svg>
	</Toolbar.Button>
</Toolbar.Root>
