<script lang="ts">
	import { linkNote, resizeNode, setElementText, unlinkNote } from '#lib/commands/index.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format, hintKey } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { Note, TextElement } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import FieldSelect from '#lib/ui/atoms/Select.svelte';
	import StyleSection from './StyleSection.svelte';
	import KeyHint from '#lib/ui/molecules/KeyHint.svelte';

	// Board 14: the note's text, what it is linked to, and its size as the non-drag path.
	let { element }: { element: Note | TextElement } = $props();
	const isNote = $derived(element.kind === 'note');
	// ui.md: notes are at least 120×60; a text element is created 120×24.
	const MIN = $derived(isNote ? { w: 120, h: 60 } : { w: 120, h: 24 });
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
	/** Below the minimum or not a number: the field goes back to the layout's value. */
	function resize(axis: 'w' | 'h', input: HTMLInputElement) {
		if (!layout) return;
		const v = Math.round(input.valueAsNumber);
		if (!Number.isFinite(v) || v < MIN[axis]) {
			input.value = String(layout[axis]);
			return;
		}
		if (v !== layout[axis])
			projectStore.run(resizeNode, { diagramId: diagram.id, id: element.id, ...layout, [axis]: v });
	}
</script>

<SectionHeading first
	><label for="note-text">{isNote ? t('note.heading') : t('text.heading')}</label></SectionHeading
>
<Field
	multiline
	id="note-text"
	class="w-full"
	value={element.text}
	onchange={(e: Event) => commitText((e.currentTarget as HTMLTextAreaElement).value)}
/>
<p class="mt-1 text-(length:--text-small) text-chrome-muted">
	{isNote ? t('note.hint') : t('text.hint')}
</p>

{#if isNote}
	<div class="head mt-5">
		<SectionHeading first>{t('note.linkedTo')}</SectionHeading>
		{#if candidates.length}
			<FieldSelect
				class="w-28 text-(length:--text-small)"
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
				<li class="flex h-8 items-center gap-2 text-(length:--text-field)">
					<span class="min-w-0 flex-1 truncate">{nameOf(id)}</span>
					<span class="text-chrome-muted">{kindOf(id)}</span>
					<IconButton
						label={t('note.unlink', { name: nameOf(id) })}
						icon="x"
						size={24}
						iconSize={11}
						stroke={2.5}
						tip={false}
						onclick={() => {
							projectStore.run(unlinkNote, { noteId: element.id, targetId: id });
							selection.set([element.id]);
						}}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-(length:--text-small) text-chrome-muted">{t('note.noLinks')}</p>
	{/if}
	<p class="mt-1 text-(length:--text-small) text-chrome-muted">
		{#if candidates.length}
			<KeyHint
				text={t('note.linkHint')}
				keys={{ link: { cap: format(byId('link.start')!.keys[0]) }, arrows: hintKey('Arrows') }}
			/>
		{:else}
			{t('note.nothingToLink')}
		{/if}
	</p>
{/if}

{#if layout}
	<SectionHeading>{t('note.size')}</SectionHeading>
	<div class="grid grid-cols-2 gap-3">
		<label class="text-chrome-muted"
			>{t('note.width')}<Field
				type="number"
				min={MIN.w}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={layout.w}
				onchange={(e: Event) => resize('w', e.currentTarget as HTMLInputElement)}
			/></label
		>
		<label class="text-chrome-muted"
			>{t('note.height')}<Field
				type="number"
				min={MIN.h}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={layout.h}
				onchange={(e: Event) => resize('h', e.currentTarget as HTMLInputElement)}
			/></label
		>
	</div>
	<p class="mt-1 text-(length:--text-small) text-chrome-muted">
		<KeyHint
			text={t('note.sizeHint', { w: MIN.w, h: MIN.h })}
			keys={{ shift: hintKey('⇧'), arrows: hintKey('Arrows') }}
		/>
	</p>
{/if}
{#if isNote}
	<StyleSection id={element.id} keys={['fill', 'line']} />
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* The heading shares a row with the link picker: no bottom gap of its own. */
	.head > :global(.section) {
		margin: 0;
	}
</style>
