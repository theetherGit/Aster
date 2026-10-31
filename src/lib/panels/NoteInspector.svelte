<script lang="ts">
	import { linkNote, setElementText, unlinkNote } from '#lib/commands/index.ts';
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
	import SizeSection from './SizeSection.svelte';
	import StyleSection from './StyleSection.svelte';
	import KeyHint from '#lib/ui/molecules/KeyHint.svelte';

	// Board 14: the note's text, what it is linked to, and its size as the non-drag path.
	let { element }: { element: Note | TextElement } = $props();
	const isNote = $derived(element.kind === 'note');
	const diagram = $derived(projectStore.diagram);
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

<SizeSection id={element.id} />
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
