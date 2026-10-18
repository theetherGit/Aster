<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { ParseReport, ParseWarning } from '#lib/mdj/parse.ts';
	import { files, openFromPicker } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// The import notice (board 08): top right, non-blocking, a short summary first and the
	// per-diagram detail on request. Read out politely; failures assertively.
	const notice = $derived(files.notice);
	const MAX_WARNINGS = 5;

	const TYPE_NAMES: Record<string, MessageKey> = {
		UMLClassDiagram: 'diagramType.UMLClassDiagram',
		UMLSequenceDiagram: 'diagramType.UMLSequenceDiagram',
		UMLUseCaseDiagram: 'diagramType.UMLUseCaseDiagram',
		UMLActivityDiagram: 'diagramType.UMLActivityDiagram',
		UMLStatechartDiagram: 'diagramType.UMLStatechartDiagram',
		UMLObjectDiagram: 'diagramType.UMLObjectDiagram',
		UMLProfileDiagram: 'diagramType.UMLProfileDiagram',
		UMLComponentDiagram: 'diagramType.UMLComponentDiagram',
		UMLDeploymentDiagram: 'diagramType.UMLDeploymentDiagram',
		UMLCommunicationDiagram: 'diagramType.UMLCommunicationDiagram',
		UMLCompositeStructureDiagram: 'diagramType.UMLCompositeStructureDiagram',
		UMLTimingDiagram: 'diagramType.UMLTimingDiagram',
		UMLInteractionOverviewDiagram: 'diagramType.UMLInteractionOverviewDiagram',
		UMLInformationFlowDiagram: 'diagramType.UMLInformationFlowDiagram',
		FCFlowchartDiagram: 'diagramType.FCFlowchartDiagram',
		DFDDiagram: 'diagramType.DFDDiagram',
		ERDDiagram: 'diagramType.ERDDiagram'
	};
	const typeName = (type: string) =>
		TYPE_NAMES[type] ? t(TYPE_NAMES[type]) : t('diagramType.other', { type });

	/** "a", "a and b", "a, b and c". */
	function list(items: string[]): string {
		if (items.length <= 1) return items[0] ?? '';
		const head = items.slice(0, -1).reduce((a, b) => t('list.more', { a, b }));
		return t('list.pair', { a: head, b: items[items.length - 1] });
	}

	function keptSentence(r: ParseReport): string | null {
		const byType: Record<string, number> = {};
		for (const h of r.hiddenDiagrams) byType[h.type] = (byType[h.type] ?? 0) + 1;
		const entries = Object.entries(byType);
		if (!entries.length) return null;
		const parts = entries.map(([type, count]) =>
			t(count === 1 ? 'diagramCount.one' : 'diagramCount.other', { count, type: typeName(type) })
		);
		const many = entries.length > 1 || entries[0][1] > 1;
		return t(many ? 'import.keptVerb.other' : 'import.keptVerb.one', { list: list(parts) });
	}

	/** Distinct classifiers and relationships placed on any diagram. */
	const placed = $derived.by(() => {
		if (notice?.kind !== 'opened') return { classifiers: 0, relationships: 0, packages: 0 };
		void projectStore.version;
		const ids = new Set(projectStore.project.diagrams.flatMap((d) => d.elementIds));
		const count = (kind: string) =>
			[...ids].filter((id) => projectStore.project.elements.get(id)?.kind === kind).length;
		return {
			classifiers: count('classifier'),
			relationships: count('relationship'),
			packages: count('package')
		};
	});

	const otherKept = (r: ParseReport) =>
		r.unknownElements - r.hiddenDiagrams.length + placed.packages + r.model.notes + r.model.texts;

	const warningText = (w: ParseWarning) => {
		const { code, ...params } = w;
		return t(`import.warning.${code}`, params as Record<string, string>);
	};
</script>

{#if notice}
	<section
		class="notice"
		class:failed={notice.kind === 'failed'}
		aria-labelledby="import-notice-title"
		role={notice.kind === 'failed' ? 'alert' : 'status'}
		data-testid="import-notice"
	>
		<header class="flex items-start gap-2">
			{#if notice.kind === 'failed'}
				<svg
					class="mt-0.5 shrink-0 text-danger"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg
				>
			{/if}
			<h2 id="import-notice-title" class="min-w-0 flex-1 text-[14px] font-semibold">
				{#if notice.kind === 'opening'}
					{t('import.opening', { file: notice.file })}
				{:else if notice.kind === 'opened'}
					{t('import.opened', { file: notice.file })}
				{:else if notice.kind === 'restored'}
					{t('import.restored', { file: notice.file })}
				{:else}
					{t('import.failed', { file: notice.file })}
				{/if}
			</h2>
			{#if notice.kind !== 'opening'}
				<button
					type="button"
					class="icon-btn h-6 w-6 shrink-0"
					aria-label={t('import.close')}
					onclick={() => (files.notice = null)}
				>
					<svg
						width="11"
						height="11"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
					>
				</button>
			{/if}
		</header>

		{#if notice.kind === 'failed'}
			<p class="body">
				{t(notice.invalid ? 'import.failedBody' : 'import.failedOther', {
					project: projectStore.project.name
				})}
			</p>
			<div class="mt-2 flex items-center gap-2">
				<button
					type="button"
					class="h-7 rounded-control border border-chrome-border px-2 hover:bg-chrome-bg"
					onclick={() => openFromPicker()}>{t('import.chooseAnother')}</button
				>
				<Collapsible.Root>
					<Collapsible.Trigger
						class="h-7 rounded-control px-1 text-chrome-muted hover:text-chrome-text hover:underline"
						>{t('import.showDetails')}</Collapsible.Trigger
					>
					<Collapsible.Content
						><pre
							class="mt-2 text-[11px] whitespace-pre-wrap text-chrome-muted">{notice.message}</pre></Collapsible.Content
					>
				</Collapsible.Root>
			</div>
		{:else if notice.kind === 'restored'}
			<p class="body">{t('import.restoredBody')}</p>
		{:else if notice.kind === 'opened'}
			{@const r = notice.report}
			{@const kept = keptSentence(r)}
			<p class="body">
				{t('import.placedSummary', placed)}
				{#if kept}<span data-testid="kept-hidden">{kept}</span>{/if}
				{#if otherKept(r) > 0}{t('import.otherKept', { count: otherKept(r) })}{/if}
			</p>

			<Collapsible.Root>
				<Collapsible.Trigger
					class="mt-2 h-6 rounded-control px-1 text-[12px] text-chrome-muted hover:text-chrome-text hover:underline"
				>
					{t('import.details')}
				</Collapsible.Trigger>
				<Collapsible.Content class="details">
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
					{#if r.hiddenDiagrams.length || r.diagrams.some((d) => d.hiddenViews)}
						<h3 class="label">{t('import.keptHidden')}</h3>
						<ul>
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
						</ul>
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
				</Collapsible.Content>
			</Collapsible.Root>
		{/if}
	</section>
{/if}

<style>
	.notice {
		position: absolute;
		top: calc(12px + var(--canvas-inset-top, 0px));
		right: 12px;
		z-index: 20;
		box-sizing: border-box;
		width: min(380px, calc(100% - 24px));
		max-height: calc(100% - 24px);
		overflow: auto;
		padding: 12px 14px 12px 16px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-left: 4px solid var(--accent);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}
	.notice.failed {
		border-left-color: var(--danger);
	}
	.body {
		margin-top: 4px;
		color: var(--chrome-muted);
		line-height: 1.45;
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
	.warnings li::marker {
		color: var(--warning);
	}
</style>
