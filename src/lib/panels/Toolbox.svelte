<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';

	// Only Class works today; the rest are placeholders until their day.
	const TOOLS: { id: Tool; key: string | null; ready: boolean; glyph: string }[] = [
		{
			id: 'select',
			key: null,
			ready: true,
			glyph: 'M4 2.5 12 8.2 8.3 8.9 10.4 13.3 9 14 6.9 9.6 4.6 12.1z'
		},
		{ id: 'class', key: 'C', ready: true, glyph: 'M2.5 3h11v10h-11zM2.5 6.5h11M2.5 10h11' },
		{ id: 'interface', key: 'I', ready: true, glyph: 'M8 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z' },
		{ id: 'enum', key: 'E', ready: true, glyph: 'M2.5 3h11v10h-11zM2.5 6h11M5.5 8.5h5M5.5 11h5' },
		{ id: 'package', key: 'P', ready: false, glyph: 'M2.5 4.5h4l1.5 1.5h5.5v7h-11z' },
		{ id: 'link', key: 'L', ready: false, glyph: 'M3.5 12.5 12.5 3.5M7 3.5h5.5V9' }
	];
	const label = (tool: (typeof TOOLS)[number]) => {
		const name = t(`ui.tool.${tool.id}`);
		return tool.key ? t('ui.toolKey', { tool: name, key: tool.key }) : name;
	};
</script>

<Toolbar.Root
	orientation="vertical"
	aria-label={t('ui.toolbox')}
	class="absolute top-3 left-3 z-10 rounded-[10px] border border-chrome-border bg-chrome-bg p-1 shadow-lg"
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
				disabled={!tool.ready}
				aria-label={label(tool)}
				title={tool.ready ? label(tool) : t('ui.comingSoon')}
				class="flex h-8 w-8 items-center justify-center rounded-control text-[13px] font-semibold text-chrome-text hover:bg-chrome-surface disabled:opacity-40 data-[state=on]:bg-accent data-[state=on]:text-on-accent"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linejoin="round"
					aria-hidden="true"><path d={tool.glyph} /></svg
				>
			</Toolbar.GroupItem>
		{/each}
	</Toolbar.Group>
</Toolbar.Root>
