<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// Board 03: StarUML's Working Diagrams, the diagrams of the project; the open one is marked.
	// Diagrams cannot be closed yet, so there is no × (DECISIONS.md). A plain list of buttons:
	// a listbox would need arrow keys and option children it does not have.
</script>

<section aria-labelledby="working-diagrams-title">
	<h2 id="working-diagrams-title" class="panel-title">{t('classic.workingDiagrams')}</h2>
	<ul class="py-1" aria-label={t('ui.diagrams')}>
		{#each projectStore.project.diagrams as d (d.id)}
			<li>
				<button
					type="button"
					aria-current={d.id === projectStore.activeDiagramId ? 'true' : undefined}
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
		border-left: 2px solid transparent;
	}
	.row:hover {
		background: var(--chrome-surface);
	}
	.row[aria-current='true'] {
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-bg));
		border-left-color: var(--accent);
	}
	@media (forced-colors: active) {
		.row[aria-current='true'] {
			border-left-color: Highlight;
		}
	}
</style>
