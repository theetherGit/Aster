<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { ParseWarning } from '#lib/mdj/parse.ts';
	import { files } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// The import notice (board 08): non-blocking, dismissible, read out politely.
	const notice = $derived(files.notice);
	const MAX_WARNINGS = 5;

	const typeName = (type: string) => {
		const key = `diagramType.${type}` as MessageKey;
		return key in TYPE_KEYS ? t(key) : t('diagramType.other', { type });
	};
	const TYPE_KEYS = Object.fromEntries(
		[
			'UMLClassDiagram',
			'UMLSequenceDiagram',
			'UMLUseCaseDiagram',
			'UMLActivityDiagram',
			'UMLStatechartDiagram',
			'UMLObjectDiagram',
			'UMLProfileDiagram',
			'UMLComponentDiagram',
			'UMLDeploymentDiagram',
			'UMLCommunicationDiagram',
			'UMLCompositeStructureDiagram',
			'UMLTimingDiagram',
			'UMLInteractionOverviewDiagram',
			'UMLInformationFlowDiagram',
			'FCFlowchartDiagram',
			'DFDDiagram',
			'ERDDiagram'
		].map((k) => [`diagramType.${k}`, true])
	);
	const warningText = (w: ParseWarning) => {
		const { code, ...params } = w;
		return t(`import.warning.${code}`, params as Record<string, string>);
	};
	const packagesOnDiagrams = $derived.by(() => {
		if (notice?.kind !== 'opened') return 0;
		void projectStore.version;
		let n = 0;
		for (const d of projectStore.project.diagrams)
			for (const id of d.elementIds)
				if (projectStore.project.elements.get(id)?.kind === 'package') n++;
		return n;
	});
</script>

{#if notice}
	<section
		class="notice"
		aria-labelledby="import-notice-title"
		role={notice.kind === 'failed' ? 'alert' : 'status'}
		data-testid="import-notice"
	>
		<header class="flex items-start gap-2">
			<h2 id="import-notice-title" class="min-w-0 flex-1 font-semibold">
				{#if notice.kind === 'opening'}
					{t('import.opening', { file: notice.file })}
				{:else if notice.kind === 'opened'}
					{t('import.opened', { file: notice.file })}
				{:else}
					{t('import.failed', { file: notice.file })}
				{/if}
			</h2>
			{#if notice.kind !== 'opening'}
				<button
					type="button"
					class="icon-btn h-6 w-6 shrink-0"
					aria-label={t('import.close')}
					onclick={() => (files.notice = null)}>×</button
				>
			{/if}
		</header>

		{#if notice.kind === 'failed'}
			<p class="mt-1">{notice.invalid ? t('import.notStarUml') : notice.message}</p>
		{:else if notice.kind === 'opened'}
			{@const r = notice.report}
			<h3 class="label">{t('import.placed')}</h3>
			<ul>
				{#each r.diagrams as d (d.id)}
					<li>
						{t('import.diagramLine', { name: d.name, nodes: d.nodes, edges: d.edges })}{d.notes
							? t('import.diagramNotes', { notes: d.notes })
							: ''}
					</li>
				{/each}
			</ul>
			<p class="text-chrome-muted">{t('import.model', r.model)}</p>

			{#if r.hiddenDiagrams.length || r.unknownElements || packagesOnDiagrams || r.diagrams.some((d) => d.hiddenViews)}
				<h3 class="label">{t('import.keptHidden')}</h3>
				<ul data-testid="kept-hidden">
					{#each r.hiddenDiagrams as h, i (i)}
						<li>
							{t('import.hiddenDiagram', {
								name: h.name || typeName(h.type),
								type: typeName(h.type)
							})}
						</li>
					{/each}
					{#each r.diagrams.filter((d) => d.hiddenViews) as d (d.id)}
						<li>{t('import.hiddenViews', { count: d.hiddenViews, diagram: d.name })}</li>
					{/each}
					{#if packagesOnDiagrams}
						<li>{t('import.packagesNotDrawn', { count: packagesOnDiagrams })}</li>
					{/if}
					{#if r.unknownElements}
						<li>{t('import.unknownElements', { count: r.unknownElements })}</li>
					{/if}
				</ul>
				<p class="text-chrome-muted">{t('import.keptHint')}</p>
			{/if}

			{#if r.warnings.length}
				<h3 class="label">{t('import.warnings')}</h3>
				<ul class="warnings">
					{#each r.warnings.slice(0, MAX_WARNINGS) as w, i (i)}
						<li>{warningText(w)}</li>
					{/each}
					{#if r.warnings.length > MAX_WARNINGS}
						<li>{t('import.moreWarnings', { count: r.warnings.length - MAX_WARNINGS })}</li>
					{/if}
				</ul>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.notice {
		position: absolute;
		right: 12px;
		bottom: 12px;
		z-index: 20;
		box-sizing: border-box;
		width: min(360px, calc(100% - 24px));
		max-height: calc(100% - 24px);
		overflow: auto;
		padding: 12px 14px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}
	.label {
		margin-top: 10px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--chrome-muted);
	}
	ul {
		margin: 2px 0 0;
		padding-left: 16px;
		list-style: disc;
	}
	.warnings li {
		color: var(--chrome-text);
	}
	.warnings li::marker {
		color: var(--warning);
	}
</style>
