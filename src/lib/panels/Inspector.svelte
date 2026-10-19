<script lang="ts">
	import { renameClass } from '#lib/canvas/inline.ts';
	import { Collapsible, Select, Tabs } from 'bits-ui';
	import { byId, effective, runCommand } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { setClassifierFlags, setClassifierKind, setNodeFlags } from '#lib/commands/index.ts';
	import { DEFAULT_DISPLAY_FLAGS, type DisplayFlags } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { MemberKind } from '#lib/mdj/expression.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { ClassifierKind, Visibility } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Checkbox from '#lib/ui/atoms/Checkbox.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import FieldSelect from '#lib/ui/atoms/Select.svelte';
	import Tab from '#lib/ui/atoms/Tab.svelte';
	import { panelSlide } from '#lib/ui/motion.ts';
	import DiagramTab from './DiagramTab.svelte';
	import DisplayFlagsForm from './DisplayFlagsForm.svelte';
	import Documentation from './Documentation.svelte';
	import MemberList from './MemberList.svelte';
	import NoteInspector from './NoteInspector.svelte';
	import RelationshipInspector from './RelationshipInspector.svelte';
	import RelationshipList from './RelationshipList.svelte';
	import { menu, menuItem } from '#lib/ui/styles.ts';

	// Modern: the 300 px inspector with its rail. Classic: StarUML's Editors, tabs Style /
	// Property / Documentation over the same fields (board 03).
	let { variant = 'modern' }: { variant?: 'modern' | 'classic' } = $props();
	const classic = $derived(variant === 'classic');
	const toggleKey = format(byId('view.inspector')!.keys[0]);

	// Commands mutate elements in place, so references never change; cloning the selected
	// element on every project version gives Svelte a new value to react to.
	const single = $derived.by(() => {
		const el =
			selection.size === 1 ? projectStore.project.elements.get(selection.list[0]) : undefined;
		return el && structuredClone(el);
	});
	const classifier = $derived(single?.kind === 'classifier' ? single : undefined);
	/** Classic's Documentation tab: any selected element that carries documentation. */
	const documented = $derived(
		single && typeof (single as { documentation?: unknown }).documentation === 'string'
			? (single as { id: string; documentation: string })
			: undefined
	);

	const KINDS: ClassifierKind[] = ['class', 'interface', 'enum', 'dataType', 'primitiveType'];
	const VIS: Visibility[] = ['public', 'protected', 'private', 'package'];
	// Derived, so the labels follow a locale applied after the panel mounted.
	const kindItems = $derived(KINDS.map((k) => ({ value: k, label: t(`ui.kind.${k}`) })));
	const visItems = $derived(VIS.map((v) => ({ value: v, label: t(`vis.${v}`) })));
	const memberKinds = $derived<MemberKind[]>(
		classifier?.classifierKind === 'enum'
			? ['literal', 'attribute', 'operation']
			: ['attribute', 'operation']
	);

	// Board 15: a classifier's own display flags, over the diagram's defaults; "Follow diagram
	// defaults" clears them (setNodeFlags with every key undefined removes each override).
	const overrides = $derived.by(() => {
		void projectStore.version;
		const l = classifier ? projectStore.diagram.layout.get(classifier.id) : undefined;
		return new Set(
			(l?.kind === 'node' && l.flags ? Object.keys(l.flags) : []) as (keyof DisplayFlags)[]
		);
	});
	let displayOpen = $state(false);
	const nodeValue = (key: keyof DisplayFlags) => {
		void projectStore.version;
		return classifier ? effective(classifier.id)[key] : DEFAULT_DISPLAY_FLAGS[key];
	};
	const nodeSet = (key: keyof DisplayFlags, v: DisplayFlags[keyof DisplayFlags]) =>
		classifier &&
		projectStore.run(setNodeFlags, {
			diagramId: projectStore.activeDiagramId,
			id: classifier.id,
			patch: { [key]: v }
		});
	const followDefaults = () =>
		classifier &&
		projectStore.run(setNodeFlags, {
			diagramId: projectStore.activeDiagramId,
			id: classifier.id,
			patch: Object.fromEntries([...overrides].map((k) => [k, undefined]))
		});

	/** A blank name is not a rename: the field goes back to the model's name. */
	const commitName = (input: HTMLInputElement) => {
		if (!classifier) return;
		const name = input.value.trim();
		if (!name) input.value = classifier.name;
		else if (name !== classifier.name) renameClass(classifier.id, name);
	};
	const flags = (f: Parameters<typeof setClassifierFlags>[1]['flags']) =>
		classifier && projectStore.run(setClassifierFlags, { id: classifier.id, flags: f });
</script>

<!-- Every field dispatches the same commands as inline editing (docs/spec/features.md, Properties panel). -->
{#if !classic && (!ui.panels.inspector || (selection.size === 0 && ui.inspectorTab !== 'diagram'))}
	<!-- Boards 18–19: a 40 px rail with one button when nothing is selected or the panel is hidden. -->
	<aside
		aria-label={t('inspector.collapsed')}
		class="flex w-10 shrink-0 justify-center border-s border-chrome-border bg-chrome-surface pt-2"
	>
		<IconButton
			label={t('inspector.show')}
			icon="panel-right"
			key={toggleKey}
			onclick={() => {
				ui.panels.inspector = true;
				if (selection.size === 0) ui.inspectorTab = 'diagram';
			}}
		/>
	</aside>
{:else}
	{#snippet panel()}
		<Tabs.Root bind:value={ui.inspectorTab}>
			<!-- Board 03: Classic's "Editors" title shares the tab row but is not part of the tablist,
			     nor a heading of its own (the aside is already named by it): a span in the title dress. -->
			<div class="flex border-b border-chrome-border px-2">
				{#if classic}
					<span class="editors-title">{t('classic.editors')}</span>
				{/if}
				<Tabs.List
					class="flex {classic ? 'editors-tabs' : ''}"
					aria-label={classic ? t('classic.editors') : t('inspector.title')}
				>
					{#if classic}
						<Tab value="diagram" class="px-2">{t('classic.tab.style')}</Tab>
						<Tab value="properties" class="px-2">{t('classic.tab.property')}</Tab>
						<Tab value="documentation" class="px-2">{t('classic.tab.documentation')}</Tab>
					{:else}
						<!-- The Text tab (ui.md) arrives with the Text view in M2; no placeholder until then. -->
						<Tab value="properties">{t('inspector.tab.properties')}</Tab>
						<Tab value="diagram">{t('inspector.tab.diagram')}</Tab>
					{/if}
				</Tabs.List>
				{#if !classic}
					<IconButton
						label={t('inspector.hide')}
						icon="panel-right-close"
						key={toggleKey}
						class="my-0.5 ms-auto text-chrome-muted"
						onclick={() => runCommand('view.inspector')}
					/>
				{/if}
			</div>
			<Tabs.Content value="properties" class="p-4">
				{#if classifier}
					{@const c = classifier}
					<!-- Board 01: the kind is the section heading (and the kind picker); name below it.
					     The Select atom is a form field, so the heading-shaped trigger stays a Bits Select. -->
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
						<span class="sr-only" id="insp-kind-label">{t('inspector.kind')}</span>
						<Select.Trigger
							id="insp-kind"
							aria-labelledby="insp-kind-label insp-kind"
							class="kind-trigger group -mx-1 flex h-6 items-center gap-1 rounded-control px-1 hover:bg-chrome-bg"
						>
							{t(`ui.kind.${c.classifierKind}`)}
							<!-- The caret stays visible at rest (muted) so the heading reads as a picker. -->
							<Icon
								name="chevron-down"
								size={10}
								stroke={3}
								class="text-chrome-muted group-hover:text-chrome-text group-focus-visible:text-chrome-text"
							/>
						</Select.Trigger>
						<Select.Portal>
							<Select.Content class={menu} sideOffset={4}>
								<Select.Viewport>
									{#each kindItems as item (item.value)}
										<Select.Item value={item.value} label={item.label} class={menuItem}
											>{item.label}</Select.Item
										>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					<label for="insp-name" class="sr-only">{t('inspector.name')}</label>
					<Field
						id="insp-name"
						class="h-9 w-full text-(length:--text-field)"
						value={c.name}
						onchange={(e: Event) => commitName(e.currentTarget as HTMLInputElement)}
					/>

					<div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
						<label for="insp-stereotype" class="text-chrome-muted"
							>{t('inspector.stereotype')}</label
						>
						<label for="insp-visibility" class="text-chrome-muted"
							>{t('inspector.visibility')}</label
						>
						<Field
							id="insp-stereotype"
							class="min-w-0"
							placeholder={t('vis.none')}
							value={c.stereotype ?? ''}
							onchange={(e: Event) =>
								flags({ stereotype: (e.currentTarget as HTMLInputElement).value.trim() || null })}
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
						<Checkbox
							label={t('inspector.abstract')}
							checked={c.isAbstract}
							onchange={(on) => flags({ isAbstract: on })}
						/>
						<Checkbox
							label={t('inspector.leaf')}
							checked={c.isLeaf}
							onchange={(on) => flags({ isLeaf: on })}
						/>
					</div>
					{#each memberKinds as kind (kind)}
						<MemberList classifier={c} {kind} />
					{/each}
					<RelationshipList classifier={c} />
					<Collapsible.Root bind:open={displayOpen} class="mt-6">
						<div class="flex h-7 items-center gap-2">
							<!-- The trigger is the heading: Collapsible owns the element, so the section
							     dress is by class here. -->
							<Collapsible.Trigger class="display-trigger rounded-control">
								<Icon
									name="chevron-right"
									size={10}
									stroke={3}
									class="text-chrome-muted {displayOpen ? 'rotate-90' : ''}"
								/>
								{t('inspector.display')}
							</Collapsible.Trigger>
							<span class="min-w-0 flex-1 truncate text-(length:--text-small) text-chrome-muted">
								{overrides.size
									? t('inspector.overrides', { n: overrides.size })
									: t('inspector.followsDiagram')}
							</span>
							{#if overrides.size}
								<Button size="sm" class="shrink-0" onclick={followDefaults}
									>{t('inspector.followDefaults')}</Button
								>
							{/if}
						</div>
						<Collapsible.Content class="mt-2">
							<DisplayFlagsForm idPrefix="node" value={nodeValue} set={nodeSet} {overrides} />
						</Collapsible.Content>
					</Collapsible.Root>
					<Documentation id={c.id} documentation={c.documentation} field="cls-doc" />
				{:else if single?.kind === 'relationship'}
					<RelationshipInspector rel={single} />
				{:else if single && (single.kind === 'note' || single.kind === 'text')}
					<NoteInspector element={single} />
				{:else if single && single.kind !== 'classifier'}
					<p class="text-chrome-muted">{t(`ui.kind.${single.kind}`)}</p>
					<h2 class="mt-1 text-(length:--text-lead) font-semibold">{elementName(single)}</h2>
				{:else if selection.size === 0}
					<p class="text-chrome-muted">{t('classic.noSelection')}</p>
				{:else}
					<p class="text-chrome-muted">{t('ui.selectedCount', { count: selection.size })}</p>
				{/if}
			</Tabs.Content>
			<Tabs.Content value="diagram" class="p-4">
				<DiagramTab />
			</Tabs.Content>
			{#if classic}
				<Tabs.Content value="documentation" class="p-4">
					{#if documented}
						<Documentation
							id={documented.id}
							documentation={documented.documentation}
							field="editors-doc"
						/>
					{:else}
						<p class="text-chrome-muted">{t('classic.noSelection')}</p>
					{/if}
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	{/snippet}
	{#if classic}
		<aside
			aria-label={t('classic.editors')}
			class="flex min-h-0 flex-1 flex-col overflow-auto border-t border-chrome-border bg-chrome-surface"
		>
			{@render panel()}
		</aside>
	{:else}
		<!-- The slide animates this wrapper's width and clips; the panel keeps its 300 px inside. -->
		<div transition:panelSlide|global class="inspector flex shrink-0 overflow-hidden">
			<aside
				aria-label={t('inspector.title')}
				class="w-[300px] shrink-0 overflow-auto border-s border-chrome-border bg-chrome-surface"
			>
				{@render panel()}
			</aside>
		</div>
	{/if}
{/if}

<style>
	/* Under 960 px the canvas would starve: the open inspector floats over it instead of beside it. */
	@media (max-width: 959px) {
		.inspector {
			position: absolute;
			top: 0;
			inset-inline-end: 0;
			bottom: 0;
			z-index: var(--z-inspector-float);
			box-shadow: var(--shadow-float);
		}
	}
	/* The section-heading dress (SectionHeading atom) on the two triggers that are headings. */
	:global(.kind-trigger),
	:global(.display-trigger) {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--chrome-muted);
		text-transform: uppercase;
		white-space: nowrap;
	}
	:global(.kind-trigger) {
		margin-bottom: 6px;
	}
	/* Board 03: "Editors" and its three tabs on one 280 px row. */
	.editors-title {
		display: flex;
		align-items: center;
		padding: 0 var(--space-1);
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--chrome-text);
	}
</style>
