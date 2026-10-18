<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// Board 03: StarUML's Working Diagrams, the diagrams of the project; the open one is marked.
	// Diagrams cannot be closed yet, so there is no × (DECISIONS.md).
</script>

<section aria-labelledby="working-diagrams-title">
	<h2 id="working-diagrams-title" class="panel-title">{t('classic.workingDiagrams')}</h2>
	<ul class="py-1" role="listbox" aria-label={t('ui.diagrams')}>
		{#each projectStore.project.diagrams as d (d.id)}
			<li>
				<button
					type="button"
					role="option"
					aria-selected={d.id === projectStore.activeDiagramId}
					class="row"
					onclick={() => (projectStore.activeDiagramId = d.id)}>{d.name}</button
				>
			</li>
		{/each}
	</ul>
</section>

<style>
	.row {
		display: flex;
		align-items: center;
		width: 100%;
		height: 24px;
		padding: 0 8px 0 10px;
		font-size: 12.5px;
		color: var(--chrome-text);
		border-left: 3px solid transparent;
	}
	.row:hover {
		background: var(--chrome-surface);
	}
	.row[aria-selected='true'] {
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-bg));
		border-left-color: var(--accent);
	}
</style>
