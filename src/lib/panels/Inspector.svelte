<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';

	const single = $derived(
		selection.size === 1 ? projectStore.project.elements.get(selection.list[0]) : undefined
	);
</script>

<!-- Placeholder: the Properties / Text / Diagram tabs arrive with the properties panel slice. -->
<aside
	aria-label={t('ui.inspector')}
	class="w-[300px] shrink-0 overflow-auto border-l border-chrome-border bg-chrome-surface p-4"
>
	{#if single}
		<p class="text-chrome-muted">
			{single.kind === 'classifier'
				? t(`ui.kind.${single.classifierKind}`)
				: t(`ui.kind.${single.kind}`)}
			{#if single.kind === 'classifier' && single.isAbstract}· {t('ui.abstract')}{/if}
		</p>
		<h2 class="mt-1 text-[15px] font-semibold">{elementName(single)}</h2>
	{:else}
		<p class="text-chrome-muted">{t('ui.selectedCount', { count: selection.size })}</p>
	{/if}
</aside>
