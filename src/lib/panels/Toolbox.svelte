<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';

	// Only Class works today; the rest are placeholders until their day.
	// Icons from the board (docs/design/html/01): 24-unit paths drawn at 15 px.
	const RECT = 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z';
	const TOOLS: { id: Tool; key: string | null; ready: boolean; paths: string[] }[] = [
		{ id: 'select', key: null, ready: true, paths: ['M5 3l14 8-6 2-3 6z'] },
		{ id: 'class', key: 'C', ready: true, paths: [RECT, 'M4 10h16M4 15h16'] },
		{ id: 'interface', key: 'I', ready: true, paths: ['M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z'] },
		{ id: 'enum', key: 'E', ready: true, paths: [RECT, 'M4 10h16M8 14h2M8 17h2M12 14h4M12 17h4'] },
		{ id: 'package', key: 'P', ready: false, paths: ['M3 8V5h7l2 2h9v13H3z'] },
		{ id: 'link', key: 'L', ready: false, paths: ['M5 19L19 5', 'M12 5h7v7'] }
	];
	const label = (tool: (typeof TOOLS)[number]) => {
		const name = t(`ui.tool.${tool.id}`);
		return tool.key ? t('ui.toolKey', { tool: name, key: tool.key }) : name;
	};
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
			{#if tool.id === 'link'}
				<span class="mx-1 h-px bg-chrome-border" aria-hidden="true"></span>
			{/if}
			<Toolbar.GroupItem
				value={tool.id}
				disabled={!tool.ready}
				aria-label={label(tool)}
				title={tool.ready ? label(tool) : t('ui.comingSoon')}
				class="flex h-8 w-8 items-center justify-center rounded-control text-[13px] font-semibold text-chrome-text hover:bg-chrome-surface disabled:opacity-40 data-[state=on]:bg-accent/15 data-[state=on]:text-accent"
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
</Toolbar.Root>
