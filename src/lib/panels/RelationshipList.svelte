<script lang="ts">
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { Classifier, Relationship } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import KeyHint from '#lib/ui/molecules/KeyHint.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
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
	// Day 2 prompt item 6: the section stays when empty and says how to make one, its key a cap.
	const linkKey = format(byId('link.start')!.keys[0]);
</script>

<SectionHeading>{t('inspector.relationships')}</SectionHeading>
{#if rels.length}
	<ul class="flex flex-col">
		{#each rels as r (r.id)}
			<li>
				<!-- A selectable row, not a CTA: the list's own dress, on tokens. -->
				<button
					type="button"
					class="-mx-1 flex h-8 w-[calc(100%+8px)] items-center gap-2 rounded-control px-1 text-start hover:bg-chrome-bg"
					onclick={() => selection.set([r.id])}
				>
					<span class="sr-only">{t('inspector.selectPrefix')}</span>
					<span class="flex min-w-0 flex-1 items-center gap-1.5 text-(length:--text-field)">
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
{:else}
	<p class="text-(length:--text-small) text-chrome-muted">
		<KeyHint
			text={t('inspector.noRelationships', { name: classifier.name })}
			keys={{ key: { cap: linkKey } }}
		/>
	</p>
{/if}
