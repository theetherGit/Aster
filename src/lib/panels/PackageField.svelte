<script lang="ts">
	import { moveToPackage } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { descendantsOf, ownerOf, qualifiedName } from '#lib/model/project.ts';
	import type { Element } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import FieldSelect from '#lib/ui/atoms/Select.svelte';

	// M3.1: the package an element is in, the keyboard and screen-reader path for what dropping a
	// node into a frame does. A package is never offered into itself or what it holds.
	let { element, id = 'insp-package' }: { element: Element; id?: string } = $props();
	const TOP = '#top';
	const items = $derived.by(() => {
		void projectStore.version;
		const p = projectStore.project;
		const own = element.kind === 'package' ? [element.id, ...descendantsOf(p, element.id)] : [];
		return [
			{ value: TOP, label: t('package.top') },
			...[...p.elements.values()]
				.filter((e) => e.kind === 'package' && !own.includes(e.id))
				.map((e) => ({ value: e.id, label: qualifiedName(p, e) }))
				.sort((a, b) => a.label.localeCompare(b.label))
		];
	});
</script>

<label for={id} class="text-chrome-muted">{t('package.in')}</label>
<FieldSelect
	{id}
	class="mt-1 w-full"
	value={ownerOf(element) ?? TOP}
	{items}
	onchange={(v) =>
		projectStore.run(moveToPackage, { moves: [{ id: element.id, to: v === TOP ? null : v }] })}
/>
