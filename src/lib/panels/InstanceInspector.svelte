<script lang="ts">
	import { replaceElement } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import {
		elementName,
		instanceFromText,
		instanceLabel,
		instanceText
	} from '#lib/model/project.ts';
	import type { Instance, Link } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import FieldSelect from '#lib/ui/atoms/Select.svelte';
	import Documentation from './Documentation.svelte';
	import StyleSection from './StyleSection.svelte';

	// M3.2: an object's name, class, stereotype and slots, or a link's name. Every field is one
	// replaceElement, the same command the canvas editor runs.
	let { element }: { element: Instance | Link } = $props();

	const NONE = '#none';
	const value = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const save = (next: Instance | Link) =>
		JSON.stringify(next) !== JSON.stringify(element) &&
		projectStore.run(replaceElement, { element: next });
	/** Optional text: empty removes the field rather than storing "". */
	function withText<T extends object>(el: T, key: keyof T & string, text: string): T {
		const next = structuredClone(el) as Record<string, unknown>;
		if (text.trim()) next[key] = text.trim();
		else delete next[key];
		return next as T;
	}
	// The project's classes by name, and the object's own class when no class has that name
	// (as the ATM fixture's "Customr" has it): never dropped by opening the list.
	const classItems = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set, never observed
		const names = new Set<string>();
		for (const el of projectStore.project.elements.values())
			if (el.kind === 'classifier' && el.name) names.add(el.name);
		if (element.kind === 'instance' && element.classifier) names.add(element.classifier);
		return [
			{ value: NONE, label: t('object.noClass') },
			...[...names].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }))
		];
	});
	const nameOf = (id: string) => {
		const el = projectStore.project.elements.get(id);
		return el ? elementName(el) : id;
	};
</script>

{#if element.kind === 'instance'}
	{@const o = element}
	<SectionHeading first>{t('ui.kind.instance')}</SectionHeading>
	<label for="obj-name" class="sr-only">{t('inspector.name')}</label>
	<Field
		id="obj-name"
		class="h-9 w-full text-(length:--text-field)"
		value={o.name}
		placeholder={t('object.anonymous')}
		onchange={(e: Event) => save({ ...o, name: value(e).trim() })}
	/>
	<div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
		<label for="obj-class" class="text-chrome-muted">{t('object.class')}</label>
		<label for="obj-stereotype" class="text-chrome-muted">{t('inspector.stereotype')}</label>
		<FieldSelect
			id="obj-class"
			class="min-w-0"
			value={o.classifier ?? NONE}
			items={classItems}
			onchange={(v) => save(withText(o, 'classifier', v === NONE ? '' : v))}
		/>
		<Field
			id="obj-stereotype"
			class="min-w-0"
			placeholder={t('vis.none')}
			value={o.stereotype ?? ''}
			onchange={(e: Event) => save(withText(o, 'stereotype', value(e)))}
		/>
	</div>
	<SectionHeading><label for="obj-slots">{t('object.slots')}</label></SectionHeading>
	<Field
		multiline
		id="obj-slots"
		class="w-full font-mono"
		value={instanceText(o).split('\n').slice(1).join('\n')}
		placeholder={t('object.slotsPlaceholder')}
		onchange={(e: Event) =>
			save({ ...instanceFromText(o, `${instanceLabel(o)}\n${value(e)}`), name: o.name })}
	/>
	<p class="mt-1 text-(length:--text-small) text-chrome-muted">{t('object.slotsHint')}</p>
	<StyleSection id={o.id} keys={['fill', 'line']} />
	<Documentation id={o.id} documentation={o.documentation} field="obj-doc" />
{:else}
	{@const l = element}
	<SectionHeading first>{t('ui.kind.link')}</SectionHeading>
	<p class="text-chrome-muted">
		{t('object.linkEnds', { source: nameOf(l.sourceId), target: nameOf(l.targetId) })}
	</p>
	<label for="link-name" class="mt-3 block text-chrome-muted">{t('inspector.name')}</label>
	<Field
		id="link-name"
		class="mt-1 w-full"
		value={l.name ?? ''}
		onchange={(e: Event) => save(withText(l, 'name', value(e)))}
	/>
	<StyleSection id={l.id} keys={['line']} />
	<Documentation id={l.id} documentation={l.documentation} field="link-doc" />
{/if}
