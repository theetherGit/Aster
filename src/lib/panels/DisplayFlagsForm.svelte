<script lang="ts">
	import { ariaKeys, format, parse } from '#lib/app/shortcuts.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { DisplayFlags } from '#lib/model/types.ts';
	import Checkbox from '#lib/ui/atoms/Checkbox.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import Segment from '#lib/ui/atoms/Segment.svelte';

	/**
	 * The display flags as a form (board 15): the Diagram tab binds it to the diagram's defaults,
	 * the Properties tab to the selected classifier's overrides. A tick always means "shown":
	 * the compartment rows invert the model's `suppress*` flags, whose names StarUML's keys keep.
	 */
	type Key = keyof DisplayFlags;
	interface Props {
		value: (key: Key) => DisplayFlags[Key];
		set: (key: Key, value: DisplayFlags[Key]) => void;
		/** Keys the target sets for itself rather than following the diagram; marked on the row. */
		overrides?: ReadonlySet<Key>;
		/** Distinguishes the two forms' field ids when both are in the document. */
		idPrefix: string;
	}
	let { value, set, overrides, idPrefix }: Props = $props();

	interface Row {
		key: Key;
		label: MessageKey;
		keys?: string;
		/** The row is ticked when the flag is false (compartments: the flag hides, the tick shows). */
		inverted?: boolean;
	}
	const SHOW: Row[] = [
		{ key: 'showVisibility', label: 'diagram.visibility', keys: '⌘⇧V' },
		{ key: 'showType', label: 'diagram.type', keys: '⌘⇧Y' },
		{ key: 'showMultiplicity', label: 'diagram.multiplicity', keys: '⌘⇧M' },
		{ key: 'showOperationSignature', label: 'diagram.signature', keys: '⌘⇧J' },
		{ key: 'showNamespace', label: 'diagram.namespace', keys: '⌘⇧N' },
		{ key: 'showProperty', label: 'diagram.property' }
	];
	const COMPARTMENTS: Row[] = [
		{ key: 'suppressAttributes', label: 'diagram.attributes', keys: '⌘⇧A', inverted: true },
		{ key: 'suppressOperations', label: 'diagram.operations', keys: '⌘⇧O', inverted: true },
		{ key: 'suppressLiterals', label: 'diagram.literals', keys: '⌘⇧T', inverted: true }
	];
	const SIZING: Row[] = [
		{ key: 'autoResize', label: 'diagram.autoResize', keys: '⌘⇧R' },
		{ key: 'wordWrap', label: 'diagram.wordWrap' }
	];
	const checked = (r: Row) => (r.inverted ? !value(r.key) : !!value(r.key));
	const toggle = (r: Row, on: boolean) => set(r.key, (r.inverted ? !on : on) as never);
	const stereo = $derived(value('stereotypeDisplay') === 'none' ? 'none' : 'label');
	const stereoItems = [
		{ value: 'none', label: t('diagram.none'), keys: ariaKeys(parse('⌘⇧0')) },
		{ value: 'label', label: t('diagram.label'), keys: ariaKeys(parse('⌘⇧1')) }
	];
</script>

{#snippet override()}
	<!-- Visible text, not a dot with a hover title: keyboard and touch users see it too. -->
	<span class="override">{t('inspector.overrideMark')}</span>
{/snippet}

{#snippet group(title: string, rows: Row[])}
	<fieldset class="group">
		<!-- The legend keeps the group's name; the heading inside it is the inspector's dress. -->
		<legend><SectionHeading first>{title}</SectionHeading></legend>
		{#each rows as r (r.key)}
			<Checkbox
				id="{idPrefix}-{r.key}"
				label={t(r.label)}
				checked={checked(r)}
				keys={r.keys ? ariaKeys(parse(r.keys)) : undefined}
				onchange={(on) => toggle(r, on)}
			>
				{#snippet trailing()}
					{#if overrides?.has(r.key)}{@render override()}{/if}
					{#if r.keys}<Kbd quiet>{format(parse(r.keys))}</Kbd>{/if}
				{/snippet}
			</Checkbox>
		{/each}
	</fieldset>
{/snippet}

{@render group(t('diagram.showOn'), SHOW)}
{@render group(t('diagram.compartments'), COMPARTMENTS)}

<div class="group">
	<div class="head">
		<SectionHeading first id="{idPrefix}-stereo" class="flex-1"
			>{t('diagram.stereotypes')}</SectionHeading
		>
		{#if overrides?.has('stereotypeDisplay')}{@render override()}{/if}
		<Kbd quiet>{format(parse('⌘⇧0'))} · {format(parse('⌘⇧1'))}</Kbd>
	</div>
	<Segment
		items={stereoItems}
		label={t('diagram.stereotypes')}
		value={stereo}
		onchange={(v) => set('stereotypeDisplay', v as 'none' | 'label')}
		fill
		class="mt-1"
	/>
</div>

{@render group(t('diagram.sizing'), SIZING)}

<style>
	/* One rhythm: 24 px between groups; the atoms set the rows. */
	.group {
		min-width: 0;
		margin-top: var(--space-6);
	}
	.group:first-child {
		margin-top: 0;
	}
	.head {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		height: var(--control-icon);
	}
	/* The heading sits in a row with its marker and key: its own bottom gap would tilt the row. */
	.head > :global(.section) {
		margin: 0;
	}
	.override {
		font-size: var(--text-caption);
		color: var(--accent-text);
	}
</style>
