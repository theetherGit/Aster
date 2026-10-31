<script lang="ts">
	import { replaceElement } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Package } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import Documentation from './Documentation.svelte';
	import PackageField from './PackageField.svelte';
	import SizeSection from './SizeSection.svelte';
	import StyleSection from './StyleSection.svelte';

	// M3.1: a package's name, the package it is in, its frame's size (the non-drag path, as a
	// note's is) and its documentation.
	let { pkg }: { pkg: Package } = $props();
	function rename(input: HTMLInputElement) {
		const name = input.value.trim();
		if (!name) input.value = pkg.name;
		else if (name !== pkg.name) projectStore.run(replaceElement, { element: { ...pkg, name } });
	}
</script>

<SectionHeading first>{t('ui.kind.package')}</SectionHeading>
<label for="pkg-name" class="sr-only">{t('inspector.name')}</label>
<Field
	id="pkg-name"
	class="h-9 w-full text-(length:--text-field)"
	value={pkg.name}
	onchange={(e: Event) => rename(e.currentTarget as HTMLInputElement)}
/>
<div class="mt-3">
	<PackageField element={pkg} />
</div>
<SizeSection id={pkg.id} />
<StyleSection id={pkg.id} keys={['fill', 'line']} />
<Documentation id={pkg.id} documentation={pkg.documentation} field="pkg-doc" />
