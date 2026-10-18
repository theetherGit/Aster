<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { Classifier, Relationship } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import RelGlyph from './RelGlyph.svelte';

	let { classifier }: { classifier: Classifier } = $props();

	// Board 01: every relationship of the class, selectable. This is also the visible
	// alternative to the 10 px edge hit band on the canvas.
	const rels = $derived.by(() => {
		void projectStore.version;
		const out: Relationship[] = [];
		for (const el of projectStore.project.elements.values())
			if (
				el.kind === 'relationship' &&
				(el.sourceId === classifier.id || el.targetId === classifier.id)
			)
				out.push(el);
		return out;
	});
	const nameOf = (id: string) => {
		const el = projectStore.project.elements.get(id);
		return el ? elementName(el) : id;
	};
	const GLYPH: Record<Relationship['relationshipKind'], string> = {
		association: '—',
		aggregation: '—◇',
		composition: '—◆',
		generalization: '—▷',
		realization: '⇢▷',
		dependency: '⇢'
	};
	function glyph(r: Relationship) {
		if (r.relationshipKind !== 'association') return GLYPH[r.relationshipKind];
		const s = r.sourceEnd?.navigable === 'navigable';
		const t = r.targetEnd?.navigable === 'navigable';
		return s && !t ? '←' : t && !s ? '→' : '—';
	}
	const summary = (r: Relationship) =>
		t('inspector.relationshipSummary', {
			source: nameOf(r.sourceId),
			sourceMultiplicity: r.sourceEnd?.multiplicity ?? '',
			glyph: glyph(r),
			targetMultiplicity: r.targetEnd?.multiplicity ?? '',
			target: nameOf(r.targetId)
		}).replace(/\s+/g, ' ');
</script>

{#if rels.length}
	<h2 class="section mt-5">{t('inspector.relationships')}</h2>
	<ul class="flex flex-col">
		{#each rels as r (r.id)}
			<li>
				<button
					type="button"
					class="-mx-1 flex h-8 w-[calc(100%+8px)] items-center gap-2 rounded-control px-1 text-left hover:bg-chrome-bg aria-pressed:bg-accent/10"
					aria-pressed={selection.has(r.id)}
					aria-label={t('inspector.selectRelationship', { summary: summary(r) })}
					onclick={() => selection.set([r.id])}
				>
					<span class="flex min-w-0 flex-1 items-center gap-1.5 text-[14px]">
						<span class="truncate">{nameOf(r.sourceId)}</span>
						<span class="shrink-0 text-chrome-muted">{r.sourceEnd?.multiplicity ?? ''}</span>
						<RelGlyph rel={r} />
						<span class="shrink-0 text-chrome-muted">{r.targetEnd?.multiplicity ?? ''}</span>
						<span class="truncate">{nameOf(r.targetId)}</span>
					</span>
					<span class="shrink-0 text-chrome-muted">{t(`rel.${r.relationshipKind}`)}</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}
