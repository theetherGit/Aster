<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { flagState, setFlag } from '#lib/app/commands.svelte.ts';
	import { format, parse } from '#lib/app/shortcuts.ts';
	import { renameDiagram } from '#lib/commands/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { DisplayFlags } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// Board 15: the diagram's display defaults; with classifiers selected the same controls
	// change only those (commands.svelte.ts decides, the keys do the same).
	const diagram = $derived(projectStore.diagram);
	void projectStore.version;
	type Flag = Exclude<keyof DisplayFlags, 'stereotypeDisplay'>;
	const row = (key: Flag, label: MessageKey, key2?: string) => ({ key, label, keys: key2 });
	const SHOW = [
		row('showVisibility', 'diagram.visibility', '⌘⇧V'),
		row('showType', 'diagram.type', '⌘⇧Y'),
		row('showMultiplicity', 'diagram.multiplicity', '⌘⇧M'),
		row('showOperationSignature', 'diagram.signature', '⌘⇧J'),
		row('showNamespace', 'diagram.namespace', '⌘⇧N'),
		row('showProperty', 'diagram.property')
	];
	const HIDE = [
		row('suppressAttributes', 'diagram.attributes', '⌘⇧A'),
		row('suppressOperations', 'diagram.operations', '⌘⇧O'),
		row('suppressLiterals', 'diagram.literals', '⌘⇧T')
	];
	const SIZING = [
		row('autoResize', 'diagram.autoResize', '⌘⇧R'),
		row('wordWrap', 'diagram.wordWrap')
	];
	const value = (key: Flag) => {
		void projectStore.version;
		return flagState(key) as boolean;
	};
</script>

<label for="diag-name" class="section">{t('diagram.heading')}</label>
<input
	id="diag-name"
	class="field h-9 w-full text-[14px]"
	aria-label={t('diagram.name')}
	value={diagram.name}
	onchange={(e) => {
		const name = e.currentTarget.value.trim();
		if (name && name !== diagram.name)
			projectStore.run(renameDiagram, { diagramId: diagram.id, name });
	}}
/>

{#snippet checks(title: string, rows: { key: Flag; label: MessageKey; keys?: string }[])}
	<h2 class="section mt-5">{title}</h2>
	<div class="flex flex-col gap-1.5">
		{#each rows as r (r.key)}
			<label class="flex h-6 items-center gap-2">
				<input
					type="checkbox"
					checked={value(r.key)}
					onchange={(e) => setFlag(r.key, e.currentTarget.checked as never)}
				/>
				<span class="flex-1">{t(r.label)}</span>
				{#if r.keys}<kbd class="text-[11px] text-chrome-muted">{format(parse(r.keys))}</kbd>{/if}
			</label>
		{/each}
	</div>
{/snippet}

{@render checks(t('diagram.showOn'), SHOW)}
{@render checks(t('diagram.hide'), HIDE)}

<h2 class="section mt-5">{t('diagram.stereotypes')}</h2>
<ToggleGroup.Root
	type="single"
	value={(() => {
		void projectStore.version;
		return flagState('stereotypeDisplay') === 'none' ? 'none' : 'label';
	})()}
	onValueChange={(v: string) => v && setFlag('stereotypeDisplay', v as 'none' | 'label')}
	aria-label={t('diagram.stereotypeDisplay')}
	class="grid grid-cols-2 overflow-hidden rounded-control border border-chrome-border"
>
	<ToggleGroup.Item
		value="none"
		class="flex h-9 items-center justify-center gap-2 border-r border-chrome-border text-[13px] data-[state=on]:bg-accent/10 data-[state=on]:font-semibold"
		>{t('diagram.none')}
		<kbd class="text-[11px] text-chrome-muted">{format(parse('⌘⇧0'))}</kbd></ToggleGroup.Item
	>
	<ToggleGroup.Item
		value="label"
		class="flex h-9 items-center justify-center gap-2 text-[13px] data-[state=on]:bg-accent/10 data-[state=on]:font-semibold"
		>{t('diagram.label')}
		<kbd class="text-[11px] text-chrome-muted">{format(parse('⌘⇧1'))}</kbd></ToggleGroup.Item
	>
</ToggleGroup.Root>

{@render checks(t('diagram.sizing'), SIZING)}

<p class="mt-5 text-[12px] leading-relaxed text-chrome-muted">{t('diagram.footnote')}</p>
