<script lang="ts">
	import { PACKAGE_MIN, replaceElement, resizeNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Package } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import Documentation from './Documentation.svelte';
	import PackageField from './PackageField.svelte';
	import StyleSection from './StyleSection.svelte';

	// M3.1: a package's name, the package it is in, its frame's size (the non-drag path, as a
	// note's is) and its documentation.
	let { pkg }: { pkg: Package } = $props();
	const diagram = $derived(projectStore.diagram);
	const layout = $derived.by(() => {
		void projectStore.version;
		const l = diagram.layout.get(pkg.id);
		return l?.kind === 'node' ? { w: l.w, h: l.h } : null;
	});
	function rename(input: HTMLInputElement) {
		const name = input.value.trim();
		if (!name) input.value = pkg.name;
		else if (name !== pkg.name) projectStore.run(replaceElement, { element: { ...pkg, name } });
	}
	/** Below the minimum or not a number: the field goes back to the layout's value. */
	function resize(axis: 'w' | 'h', input: HTMLInputElement) {
		if (!layout) return;
		const v = Math.round(input.valueAsNumber);
		if (!Number.isFinite(v) || v < PACKAGE_MIN[axis]) {
			input.value = String(layout[axis]);
			return;
		}
		if (v !== layout[axis])
			projectStore.run(resizeNode, { diagramId: diagram.id, id: pkg.id, ...layout, [axis]: v });
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
{#if layout}
	<SectionHeading>{t('note.size')}</SectionHeading>
	<div class="grid grid-cols-2 gap-3">
		<label class="text-chrome-muted"
			>{t('note.width')}<Field
				type="number"
				min={PACKAGE_MIN.w}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={layout.w}
				onchange={(e: Event) => resize('w', e.currentTarget as HTMLInputElement)}
			/></label
		>
		<label class="text-chrome-muted"
			>{t('note.height')}<Field
				type="number"
				min={PACKAGE_MIN.h}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={layout.h}
				onchange={(e: Event) => resize('h', e.currentTarget as HTMLInputElement)}
			/></label
		>
	</div>
{/if}
<StyleSection id={pkg.id} keys={['fill', 'line']} />
<Documentation id={pkg.id} documentation={pkg.documentation} field="pkg-doc" />
