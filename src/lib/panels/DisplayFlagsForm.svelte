<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { ariaKeys, format, parse } from '#lib/app/shortcuts.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { DisplayFlags } from '#lib/model/types.ts';

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
</script>

{#snippet group(title: string, rows: Row[])}
	<fieldset class="group">
		<legend class="section">{title}</legend>
		{#each rows as r (r.key)}
			<label class="row" for="{idPrefix}-{r.key}">
				<input
					id="{idPrefix}-{r.key}"
					type="checkbox"
					checked={checked(r)}
					aria-keyshortcuts={r.keys ? ariaKeys(parse(r.keys)) : undefined}
					onchange={(e) => toggle(r, e.currentTarget.checked)}
				/>
				<span class="flex-1">{t(r.label)}</span>
				{#if overrides?.has(r.key)}
					<!-- Visible text, not a dot with a hover title: keyboard and touch users see it too. -->
					<span class="override">{t('inspector.overrideMark')}</span>
				{/if}
				{#if r.keys}<kbd>{format(parse(r.keys))}</kbd>{/if}
			</label>
		{/each}
	</fieldset>
{/snippet}

{@render group(t('diagram.showOn'), SHOW)}
{@render group(t('diagram.compartments'), COMPARTMENTS)}

<div class="group">
	<div class="row">
		<span id="{idPrefix}-stereo" class="section mb-0 flex-1">{t('diagram.stereotypes')}</span>
		{#if overrides?.has('stereotypeDisplay')}
			<span class="override">{t('inspector.overrideMark')}</span>
		{/if}
		<kbd>{format(parse('⌘⇧0'))} · {format(parse('⌘⇧1'))}</kbd>
	</div>
	<ToggleGroup.Root
		type="single"
		value={stereo}
		onValueChange={(v: string) => v && set('stereotypeDisplay', v as 'none' | 'label')}
		aria-labelledby="{idPrefix}-stereo"
		class="segment mt-1"
	>
		<ToggleGroup.Item value="none" class="segment-item" aria-keyshortcuts={ariaKeys(parse('⌘⇧0'))}
			>{t('diagram.none')}</ToggleGroup.Item
		>
		<ToggleGroup.Item value="label" class="segment-item" aria-keyshortcuts={ariaKeys(parse('⌘⇧1'))}
			>{t('diagram.label')}</ToggleGroup.Item
		>
	</ToggleGroup.Root>
</div>

{@render group(t('diagram.sizing'), SIZING)}

<style>
	/* One rhythm: 24 px between groups, 6 px under a heading, 28 px rows. */
	.group {
		min-width: 0;
		margin-top: 24px;
	}
	.group:first-child {
		margin-top: 0;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		height: 28px;
	}
	kbd {
		font-size: 11px;
		color: var(--chrome-muted);
	}
	.override {
		font-size: 11px;
		color: var(--accent-text);
	}
</style>
