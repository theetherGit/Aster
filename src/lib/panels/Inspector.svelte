<script lang="ts">
	import { Select, Tabs } from 'bits-ui';
	import { renameClassifier, setClassifierFlags, setClassifierKind } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { MemberKind } from '#lib/mdj/expression.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { ClassifierKind, Visibility } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import MemberList from './MemberList.svelte';
	import RelationshipInspector from './RelationshipInspector.svelte';

	// Commands mutate elements in place, so references never change; cloning the selected
	// element on every project version gives Svelte a new value to react to.
	const single = $derived.by(() => {
		const el =
			selection.size === 1 ? projectStore.project.elements.get(selection.list[0]) : undefined;
		return el && structuredClone(el);
	});
	const classifier = $derived(single?.kind === 'classifier' ? single : undefined);

	const KINDS: ClassifierKind[] = ['class', 'interface', 'enum', 'dataType', 'primitiveType'];
	const VIS: Visibility[] = ['public', 'protected', 'private', 'package'];
	const kindItems = KINDS.map((k) => ({ value: k, label: t(`ui.kind.${k}`) }));
	const visItems = VIS.map((v) => ({ value: v, label: t(`vis.${v}`) }));
	const memberKinds = $derived<MemberKind[]>(
		classifier?.classifierKind === 'enum'
			? ['literal', 'attribute', 'operation']
			: ['attribute', 'operation']
	);

	const commitName = (name: string) => {
		if (classifier && name.trim() && name.trim() !== classifier.name)
			projectStore.run(renameClassifier, { id: classifier.id, name: name.trim() });
	};
	const flags = (f: Parameters<typeof setClassifierFlags>[1]['flags']) =>
		classifier && projectStore.run(setClassifierFlags, { id: classifier.id, flags: f });
</script>

<!-- Every field dispatches the same commands as inline editing (docs/spec/features.md, Properties panel). -->
<aside
	aria-label={t('inspector.title')}
	class="w-[300px] shrink-0 overflow-auto border-l border-chrome-border bg-chrome-surface"
>
	<Tabs.Root value="properties">
		<Tabs.List class="flex border-b border-chrome-border px-2" aria-label={t('inspector.title')}>
			<Tabs.Trigger value="properties" class="tab">{t('inspector.tab.properties')}</Tabs.Trigger>
			<Tabs.Trigger value="text" class="tab" disabled title={t('ui.comingSoon')}
				>{t('inspector.tab.text')}</Tabs.Trigger
			>
			<Tabs.Trigger value="diagram" class="tab" disabled title={t('ui.comingSoon')}
				>{t('inspector.tab.diagram')}</Tabs.Trigger
			>
		</Tabs.List>
		<Tabs.Content value="properties" class="p-4">
			{#if classifier}
				{@const c = classifier}
				<div class="grid grid-cols-[88px_1fr] items-center gap-x-2 gap-y-2">
					<label for="insp-name">{t('inspector.name')}</label>
					<input
						id="insp-name"
						class="field"
						value={c.name}
						onchange={(e) => commitName(e.currentTarget.value)}
					/>

					<label for="insp-kind">{t('inspector.kind')}</label>
					<Select.Root
						type="single"
						value={c.classifierKind}
						items={kindItems}
						onValueChange={(v: string) =>
							projectStore.run(setClassifierKind, {
								id: c.id,
								classifierKind: v as ClassifierKind
							})}
					>
						<Select.Trigger id="insp-kind" class="field text-left"
							>{t(`ui.kind.${c.classifierKind}`)}</Select.Trigger
						>
						<Select.Portal>
							<Select.Content class="menu" sideOffset={4}>
								<Select.Viewport>
									{#each kindItems as item (item.value)}
										<Select.Item value={item.value} label={item.label} class="menu-item"
											>{item.label}</Select.Item
										>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>

					<label for="insp-stereotype">{t('inspector.stereotype')}</label>
					<input
						id="insp-stereotype"
						class="field"
						value={c.stereotype ?? ''}
						onchange={(e) => flags({ stereotype: e.currentTarget.value.trim() || null })}
					/>

					<label for="insp-visibility">{t('inspector.visibility')}</label>
					<Select.Root
						type="single"
						value={c.visibility}
						items={visItems}
						onValueChange={(v: string) => flags({ visibility: v as Visibility })}
					>
						<Select.Trigger id="insp-visibility" class="field text-left"
							>{t(`vis.${c.visibility}`)}</Select.Trigger
						>
						<Select.Portal>
							<Select.Content class="menu" sideOffset={4}>
								<Select.Viewport>
									{#each visItems as item (item.value)}
										<Select.Item value={item.value} label={item.label} class="menu-item"
											>{item.label}</Select.Item
										>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>

					<span></span>
					<label class="flex h-6 items-center gap-2"
						><input
							type="checkbox"
							checked={c.isAbstract}
							onchange={(e) => flags({ isAbstract: e.currentTarget.checked })}
						/>{t('inspector.abstract')}</label
					>
					<span></span>
					<label class="flex h-6 items-center gap-2"
						><input
							type="checkbox"
							checked={c.isLeaf}
							onchange={(e) => flags({ isLeaf: e.currentTarget.checked })}
						/>{t('inspector.leaf')}</label
					>
				</div>
				{#each memberKinds as kind (kind)}
					<MemberList classifier={c} {kind} />
				{/each}
			{:else if single?.kind === 'relationship'}
				<RelationshipInspector rel={single} />
			{:else if single && single.kind !== 'classifier'}
				<p class="text-chrome-muted">{t(`ui.kind.${single.kind}`)}</p>
				<h2 class="mt-1 text-[15px] font-semibold">{elementName(single)}</h2>
			{:else}
				<p class="text-chrome-muted">{t('ui.selectedCount', { count: selection.size })}</p>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</aside>
