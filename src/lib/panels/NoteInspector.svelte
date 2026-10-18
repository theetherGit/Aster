<script lang="ts">
	import { linkNote, resizeNode, setElementText, unlinkNote } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { Note, TextElement } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import FieldSelect from './FieldSelect.svelte';

	// Board 14: the note's text, what it is linked to, and its size as the non-drag path.
	let { element }: { element: Note | TextElement } = $props();
	const isNote = $derived(element.kind === 'note');
	const diagram = $derived(projectStore.diagram);
	const layout = $derived.by(() => {
		void projectStore.version;
		const l = diagram.layout.get(element.id);
		return l?.kind === 'node' ? { w: l.w, h: l.h } : null;
	});
	const linked = $derived(element.kind === 'note' ? element.linkedIds : []);
	const nameOf = (id: string) => {
		const el = projectStore.project.elements.get(id);
		return el ? elementName(el) : id;
	};
	const kindOf = (id: string) => {
		const el = projectStore.project.elements.get(id);
		return el
			? t(`ui.kind.${el.kind === 'classifier' ? el.classifierKind : el.kind}`).toLowerCase()
			: '';
	};
	/** Classifiers on this diagram the note is not linked to yet. */
	const candidates = $derived(
		diagram.elementIds
			.filter((id) => {
				const el = projectStore.project.elements.get(id);
				return el?.kind === 'classifier' && !linked.includes(id) && id !== element.id;
			})
			.map((id) => ({ value: id, label: nameOf(id) }))
	);
	const commitText = (text: string) =>
		text !== element.text && projectStore.run(setElementText, { id: element.id, text });
	const resize = (w: number, h: number) =>
		layout &&
		Number.isFinite(w) &&
		Number.isFinite(h) &&
		(w !== layout.w || h !== layout.h) &&
		projectStore.run(resizeNode, { diagramId: diagram.id, id: element.id, w, h });
</script>

<label for="note-text" class="section">{isNote ? t('note.heading') : t('text.heading')}</label>
<textarea
	id="note-text"
	class="field h-24 w-full resize-y py-1"
	value={element.text}
	onchange={(e) => commitText(e.currentTarget.value)}></textarea>
<p class="mt-1 text-[12px] text-chrome-muted">{isNote ? t('note.hint') : t('text.hint')}</p>

{#if isNote}
	<div class="mt-5 flex items-center justify-between">
		<h2 class="section mb-0">{t('note.linkedTo')}</h2>
		{#if candidates.length}
			<FieldSelect
				class="h-7 w-28 text-[12px]"
				value=""
				items={[{ value: '', label: t('note.link') }, ...candidates]}
				ariaLabel={t('note.linkTo')}
				onchange={(v) => v && projectStore.run(linkNote, { noteId: element.id, targetId: v })}
			/>
		{/if}
	</div>
	{#if linked.length}
		<ul class="mt-1 flex flex-col">
			{#each linked as id (id)}
				<li class="flex h-8 items-center gap-2 text-[14px]">
					<span class="min-w-0 flex-1 truncate">{nameOf(id)}</span>
					<span class="text-chrome-muted">{kindOf(id)}</span>
					<button
						type="button"
						class="icon-btn h-6 w-6"
						aria-label={t('note.unlink', { name: nameOf(id) })}
						onclick={() => {
							projectStore.run(unlinkNote, { noteId: element.id, targetId: id });
							selection.set([element.id]);
						}}
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
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-[12px] text-chrome-muted">{t('note.noLinks')}</p>
	{/if}
	<p class="mt-1 text-[12px] text-chrome-muted">{t('note.linkHint')}</p>
{/if}

{#if layout}
	<h2 class="section mt-5">{t('note.size')}</h2>
	<div class="grid grid-cols-2 gap-3">
		<label class="text-chrome-muted"
			>{t('note.width')}<input
				type="number"
				class="field mt-1 w-full"
				value={layout.w}
				onchange={(e) => resize(e.currentTarget.valueAsNumber, layout!.h)}
			/></label
		>
		<label class="text-chrome-muted"
			>{t('note.height')}<input
				type="number"
				class="field mt-1 w-full"
				value={layout.h}
				onchange={(e) => resize(layout!.w, e.currentTarget.valueAsNumber)}
			/></label
		>
	</div>
	<p class="mt-1 text-[12px] text-chrome-muted">{t('note.sizeHint')}</p>
{/if}
