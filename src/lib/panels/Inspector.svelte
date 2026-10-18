<script lang="ts">
	import { Select, Tabs } from 'bits-ui';
	import {
		renameClassifier,
		setClassifierFlags,
		setClassifierKind,
		setDocumentation
	} from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { MemberKind } from '#lib/mdj/expression.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { ClassifierKind, Visibility } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import MemberList from './MemberList.svelte';
	import RelationshipInspector from './RelationshipInspector.svelte';
	import FieldSelect from './FieldSelect.svelte';
	import RelationshipList from './RelationshipList.svelte';
	import DiagramTab from './DiagramTab.svelte';
	import { ui } from '#lib/stores/ui.svelte.ts';

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
{#if !ui.panels.inspector || (selection.size === 0 && ui.inspectorTab !== 'diagram')}
	<!-- Boards 18–19: a 40 px rail with one button when nothing is selected or the panel is hidden. -->
	<aside
		aria-label={t('inspector.collapsed')}
		class="flex w-10 shrink-0 justify-center border-l border-chrome-border bg-chrome-surface pt-2"
	>
		<button
			type="button"
			class="icon-btn"
			aria-label={t('inspector.show')}
			title={t('inspector.show')}
			onclick={() => {
				ui.panels.inspector = true;
				if (selection.size === 0) ui.inspectorTab = 'diagram';
			}}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
				><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg
			>
		</button>
	</aside>
{:else}
	<aside
		aria-label={t('inspector.title')}
		class="w-[300px] shrink-0 overflow-auto border-l border-chrome-border bg-chrome-surface"
	>
		<Tabs.Root bind:value={ui.inspectorTab}>
			<Tabs.List class="flex border-b border-chrome-border px-2" aria-label={t('inspector.title')}>
				<Tabs.Trigger value="properties" class="tab">{t('inspector.tab.properties')}</Tabs.Trigger>
				<Tabs.Trigger value="text" class="tab" disabled title={t('ui.comingSoon')}
					>{t('inspector.tab.text')}</Tabs.Trigger
				>
				<Tabs.Trigger value="diagram" class="tab">{t('inspector.tab.diagram')}</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="properties" class="p-4">
				{#if classifier}
					{@const c = classifier}
					<!-- Board 01: the kind is the section heading (and the kind picker); name below it. -->
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
						<Select.Trigger
							id="insp-kind"
							aria-label={t('inspector.kind')}
							class="section group -mx-1 flex h-6 items-center gap-1 rounded-control px-1 hover:bg-chrome-bg"
						>
							{t(`ui.kind.${c.classifierKind}`)}
							<svg
								class="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100"
								width="10"
								height="10"
								viewBox="0 0 10 10"
								aria-hidden="true"
								fill="currentColor"><path d="M1 3l4 4 4-4z" /></svg
							>
						</Select.Trigger>
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
					<label for="insp-name" class="sr-only">{t('inspector.name')}</label>
					<input
						id="insp-name"
						class="field h-9 w-full text-[14px]"
						value={c.name}
						onchange={(e) => commitName(e.currentTarget.value)}
					/>

					<div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
						<label for="insp-stereotype" class="text-chrome-muted"
							>{t('inspector.stereotype')}</label
						>
						<label for="insp-visibility" class="text-chrome-muted"
							>{t('inspector.visibility')}</label
						>
						<input
							id="insp-stereotype"
							class="field min-w-0"
							placeholder={t('vis.none')}
							value={c.stereotype ?? ''}
							onchange={(e) => flags({ stereotype: e.currentTarget.value.trim() || null })}
						/>
						<FieldSelect
							id="insp-visibility"
							class="min-w-0"
							value={c.visibility}
							items={visItems}
							onchange={(v) => flags({ visibility: v as Visibility })}
						/>
					</div>
					<div class="mt-3 flex items-center gap-5">
						<label class="flex h-6 items-center gap-2"
							><input
								type="checkbox"
								checked={c.isAbstract}
								onchange={(e) => flags({ isAbstract: e.currentTarget.checked })}
							/>{t('inspector.abstract')}</label
						>
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
					<RelationshipList classifier={c} />
					<h2 class="section mt-5"><label for="cls-doc">{t('inspector.documentation')}</label></h2>
					<textarea
						id="cls-doc"
						class="field h-20 w-full resize-y py-1"
						placeholder={t('inspector.markdown')}
						value={c.documentation}
						onchange={(e) =>
							e.currentTarget.value !== c.documentation &&
							projectStore.run(setDocumentation, {
								id: c.id,
								documentation: e.currentTarget.value
							})}></textarea>
				{:else if single?.kind === 'relationship'}
					<RelationshipInspector rel={single} />
				{:else if single && single.kind !== 'classifier'}
					<p class="text-chrome-muted">{t(`ui.kind.${single.kind}`)}</p>
					<h2 class="mt-1 text-[15px] font-semibold">{elementName(single)}</h2>
				{:else}
					<p class="text-chrome-muted">{t('ui.selectedCount', { count: selection.size })}</p>
				{/if}
			</Tabs.Content>
			<Tabs.Content value="diagram" class="p-4">
				<DiagramTab />
			</Tabs.Content>
		</Tabs.Root>
	</aside>
{/if}
