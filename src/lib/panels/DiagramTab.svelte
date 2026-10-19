<script lang="ts">
	import { renameDiagram, setDiagramDefaults } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { DisplayFlags } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import DisplayFlagsForm from './DisplayFlagsForm.svelte';

	// Board 15: the diagram's name and its display defaults, nothing else. Per-classifier
	// overrides live in the Properties tab's Display section; the keys still act on the selection
	// when there is one (commands.svelte.ts).
	const diagram = $derived(projectStore.diagram);
	const value = (key: keyof DisplayFlags) => {
		void projectStore.version;
		return diagram.defaults[key];
	};
	const set = (key: keyof DisplayFlags, v: DisplayFlags[keyof DisplayFlags]) =>
		projectStore.run(setDiagramDefaults, { diagramId: diagram.id, patch: { [key]: v } });
</script>

<SectionHeading first>{t('diagram.heading')}</SectionHeading>
<label for="diag-name" class="mb-1 block text-chrome-muted">{t('diagram.name')}</label>
<Field
	id="diag-name"
	class="h-9 w-full text-(length:--text-field)"
	value={diagram.name}
	onchange={(e: Event) => {
		const input = e.currentTarget as HTMLInputElement;
		const name = input.value.trim();
		// A blank name is not a rename: the field goes back to the diagram's name.
		if (!name) input.value = diagram.name;
		else if (name !== diagram.name)
			projectStore.run(renameDiagram, { diagramId: diagram.id, name });
	}}
/>

<div class="mt-6">
	<DisplayFlagsForm idPrefix="diag" {value} {set} />
</div>
