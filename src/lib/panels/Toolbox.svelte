<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';

	// Only Class works today; the rest are placeholders until their day.
	const TOOLS: { id: Tool; key: string | null; ready: boolean; glyph: string }[] = [
		{ id: 'select', key: null, ready: true, glyph: '↖' },
		{ id: 'class', key: 'C', ready: true, glyph: 'C' },
		{ id: 'interface', key: 'I', ready: true, glyph: 'I' },
		{ id: 'enum', key: 'E', ready: true, glyph: 'E' },
		{ id: 'package', key: 'P', ready: false, glyph: 'P' },
		{ id: 'link', key: 'L', ready: false, glyph: '⟶' }
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
				<span aria-hidden="true">{tool.glyph}</span>
			</Toolbar.GroupItem>
		{/each}
	</Toolbar.Group>
</Toolbar.Root>
