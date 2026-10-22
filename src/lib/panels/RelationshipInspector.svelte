<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { DEFAULT_OFFSETS } from '#lib/canvas/edges/geometry.ts';
	import { labelsFor } from '#lib/canvas/edges/notation.ts';
	import {
		addWaypoint,
		batch,
		moveWaypoint,
		removeWaypoint,
		setEnd,
		setLabelOffset,
		setLineStyle,
		setRelationshipKind,
		setRelationshipName,
		setRelationshipStereotype,
		type EndPatch
	} from '#lib/commands/index.ts';
	import { serialise } from '#lib/commands/registry.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { elementName, isAssociationKind } from '#lib/model/project.ts';
	import type {
		EdgeLayout,
		End,
		LabelKey,
		LineStyle,
		Relationship,
		RelationshipKind,
		Visibility
	} from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import FieldSelect from '#lib/ui/atoms/Select.svelte';
	import Documentation from './Documentation.svelte';
	import StyleSection from './StyleSection.svelte';

	let { rel }: { rel: Relationship } = $props();

	const diagramId = $derived(projectStore.activeDiagramId);
	// Commands mutate the layout in place; a per-version copy gives Svelte a new value.
	const layout = $derived.by((): EdgeLayout | undefined => {
		const l = projectStore.diagram.layout.get(rel.id);
		return l?.kind === 'edge' ? structuredClone(l) : undefined;
	});
	const nameOf = (id: string) => {
		const el = projectStore.project.elements.get(id);
		return el ? elementName(el) : id;
	};

	const KINDS: RelationshipKind[] = [
		'association',
		'aggregation',
		'composition',
		'generalization',
		'realization',
		'dependency'
	];
	const PRESETS = ['1', '0..1', '*', '1..*', '0..*'];
	const STYLES: LineStyle[] = ['rectilinear', 'oblique', 'roundrect', 'curve'];
	// Board 13 icons (docs/design/html/13), 22×14.
	const STYLE_PATH: Record<LineStyle, string> = {
		rectilinear: 'M1 12H11V2H21',
		oblique: 'M1 12L21 2',
		roundrect: 'M1 12H7Q11 12 11 8V6Q11 2 15 2H21',
		curve: 'M1 12C9 12 13 2 21 2'
	};
	const styleTitle = (style: LineStyle) =>
		t('lineStyle.titled', {
			style: t(`lineStyle.${style}`),
			keys: format(byId(`format.${style}`)!.keys[0])
		});
	const endField = (field: string, end: 'source' | 'target') =>
		t('inspector.endField', {
			field,
			end: nameOf(end === 'source' ? rel.sourceId : rel.targetId)
		});
	const kindItems = $derived(KINDS.map((k) => ({ value: k, label: t(`ui.rel.${k}`) })));
	const navItems = (['unspecified', 'navigable', 'notNavigable'] as const).map((n) => ({
		value: n,
		label: t(`nav.${n}`)
	}));
	const visItems = [
		{ value: 'none', label: t('vis.none') },
		...(['public', 'protected', 'private', 'package'] as Visibility[]).map((v) => ({
			value: v,
			label: t(`vis.${v}`)
		}))
	];

	const run = <A,>(f: Parameters<typeof projectStore.run<A>>[0], args: A) =>
		projectStore.run(f, args);
	const text = (v: string) => v.trim() || null;
	const value = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const number = (e: Event) => (e.currentTarget as HTMLInputElement).valueAsNumber;
	const patchEnd = (end: 'source' | 'target', patch: EndPatch) =>
		run(setEnd, { id: rel.id, end, patch });

	const ends = $derived(
		rel.sourceEnd && rel.targetEnd
			? ([
					['source', rel.sourceEnd, nameOf(rel.sourceId)],
					['target', rel.targetEnd, nameOf(rel.targetId)]
				] as ['source' | 'target', End, string][])
			: []
	);
	const labelKeys = $derived(labelsFor(rel, projectStore.diagram.defaults));
	const offsetOf = (key: LabelKey) => layout?.labelOffsets[key] ?? DEFAULT_OFFSETS[key];
	const isDefault = (key: LabelKey) => !layout?.labelOffsets[key];
	const anyMoved = $derived(labelKeys.some((l) => !isDefault(l.key)));
	const deg = (rad: number) => Math.round((rad * 180) / Math.PI);
	const labelName = (key: LabelKey, at: 'source' | 'target' | 'mid') =>
		at === 'mid'
			? t('inspector.labelMiddle', { label: t(`label.${key}`) })
			: t('inspector.labelEnd', {
					label: t(`label.${key}`),
					end: nameOf(at === 'source' ? rel.sourceId : rel.targetId)
				});

	function setOffset(key: LabelKey, patch: { distance?: number; degrees?: number }) {
		const o = offsetOf(key);
		const offset = {
			alpha: patch.degrees === undefined ? o.alpha : (patch.degrees * Math.PI) / 180,
			distance: patch.distance ?? o.distance
		};
		if (Number.isFinite(offset.alpha) && Number.isFinite(offset.distance))
			run(setLabelOffset, { diagramId, id: rel.id, key, offset });
	}
	function resetLabels() {
		const keys = Object.keys(layout?.labelOffsets ?? {}) as LabelKey[];
		if (!keys.length) return;
		const p = projectStore.project;
		run(batch, {
			label: t('cmd.resetLabels', { name: elementName(rel) }),
			commands: keys.map((key) =>
				serialise(setLabelOffset(p, { diagramId, id: rel.id, key, offset: null }))
			)
		});
	}
	function addPoint() {
		if (!layout) return;
		const at = (id: string) => {
			const l = projectStore.diagram.layout.get(id);
			return l?.kind === 'node' ? { x: l.x + l.w / 2, y: l.y + l.h / 2 } : { x: 0, y: 0 };
		};
		const from = layout.waypoints.at(-1) ?? at(rel.sourceId);
		const to = at(rel.targetId);
		const point = {
			x: Math.round((from.x + to.x) / 2),
			y: Math.round((from.y + to.y) / 2) - (rel.sourceId === rel.targetId ? 60 : 0)
		};
		run(addWaypoint, { diagramId, id: rel.id, index: layout.waypoints.length, point });
	}
	function movePoint(index: number, axis: 'x' | 'y', value: number) {
		const w = layout?.waypoints[index];
		if (!w || !Number.isFinite(value) || w[axis] === value) return;
		run(moveWaypoint, { diagramId, id: rel.id, index, point: { ...w, [axis]: Math.round(value) } });
	}
</script>

<!-- Board 13: kind and name side by side, both ends as columns, line style as icons. -->
<SectionHeading first>{t(`ui.rel.${rel.relationshipKind}`)}</SectionHeading>
<div class="grid grid-cols-2 gap-x-3 gap-y-1">
	<label for="rel-kind" class="text-chrome-muted">{t('inspector.kind')}</label>
	<label for="rel-name" class="text-chrome-muted">{t('inspector.name')}</label>
	<FieldSelect
		id="rel-kind"
		value={rel.relationshipKind}
		items={kindItems}
		onchange={(v) =>
			run(setRelationshipKind, { id: rel.id, relationshipKind: v as RelationshipKind })}
	/>
	<Field
		id="rel-name"
		placeholder={t('vis.none')}
		value={rel.name ?? ''}
		onchange={(e: Event) =>
			text(value(e)) !== (rel.name ?? null) &&
			run(setRelationshipName, { id: rel.id, name: text(value(e)) })}
	/>
	{#if !isAssociationKind(rel.relationshipKind)}
		<label for="rel-stereotype" class="text-chrome-muted">{t('inspector.stereotype')}</label>
		<span></span>
		<Field
			id="rel-stereotype"
			placeholder={t('vis.none')}
			value={rel.stereotype ?? ''}
			onchange={(e: Event) =>
				text(value(e)) !== (rel.stereotype ?? null) &&
				run(setRelationshipStereotype, { id: rel.id, stereotype: text(value(e)) })}
		/>
	{/if}
</div>

{#if ends.length}
	<SectionHeading>{t('inspector.ends')}</SectionHeading>
	<div
		class="grid grid-cols-[64px_1fr_1fr] items-center gap-x-2 gap-y-2 text-(length:--text-small)"
	>
		<span></span>
		{#each ends as [end, , owner] (end)}<span class="truncate font-semibold" id="end-{end}"
				>{owner}</span
			>{/each}
		<span class="text-chrome-muted" id="ends-role">{t('inspector.role')}</span>
		{#each ends as [end, e] (end)}
			<Field
				class="min-w-0"
				aria-label={endField(t('inspector.role'), end)}
				id="{end}-role"
				placeholder={t('vis.none')}
				value={e.role ?? ''}
				onchange={(ev: Event) => patchEnd(end, { role: text(value(ev)) })}
			/>
		{/each}
		<span class="text-chrome-muted" id="ends-mult">{t('inspector.multiplicity')}</span>
		{#each ends as [end, e] (end)}
			<Field
				class="min-w-0"
				aria-label={endField(t('inspector.multiplicity'), end)}
				id="{end}-mult"
				value={e.multiplicity ?? ''}
				onchange={(ev: Event) => patchEnd(end, { multiplicity: text(value(ev)) })}
			/>
		{/each}
		<!-- Multiplicity presets (features list #11): one click, typing still allowed. Pills that
		     wrap inside a 1fr column; the Segment atom's bordered grid would not fit five of them. -->
		<span></span>
		{#each ends as [end, e, owner] (end)}
			<ToggleGroup.Root
				type="single"
				value={PRESETS.includes(e.multiplicity ?? '') ? (e.multiplicity ?? '') : ''}
				onValueChange={(v: string) => v && patchEnd(end, { multiplicity: v })}
				aria-label={endField(t('inspector.multiplicityPresets'), end)}
				class="flex flex-wrap gap-1"
			>
				{#each PRESETS as m (m)}
					<ToggleGroup.Item
						value={m}
						class="chip"
						aria-label={t('inspector.multiplicityPreset', { value: m, end: owner })}
						>{m}</ToggleGroup.Item
					>
				{/each}
			</ToggleGroup.Root>
		{/each}
		<span class="text-chrome-muted" id="ends-nav">{t('inspector.navigable')}</span>
		{#each ends as [end, e] (end)}
			<FieldSelect
				id="{end}-nav"
				class="min-w-0"
				ariaLabel={endField(t('inspector.navigability'), end)}
				value={e.navigable}
				items={navItems}
				onchange={(v) => patchEnd(end, { navigable: v as End['navigable'] })}
			/>
		{/each}
		<span class="text-chrome-muted" id="ends-vis">{t('inspector.visibility')}</span>
		{#each ends as [end, e] (end)}
			<FieldSelect
				id="{end}-vis"
				class="min-w-0"
				ariaLabel={endField(t('inspector.visibility'), end)}
				value={e.visibility ?? 'none'}
				items={visItems}
				onchange={(v) => patchEnd(end, { visibility: v === 'none' ? null : (v as Visibility) })}
			/>
		{/each}
	</div>
{/if}

{#if layout}
	<SectionHeading>{t('inspector.lineStyle')}</SectionHeading>
	<!-- Four icon-over-label tiles, 56 px tall: the Segment atom is a one-line text control. -->
	<ToggleGroup.Root
		type="single"
		value={layout.lineStyle}
		onValueChange={(v: string) =>
			v &&
			v !== layout?.lineStyle &&
			run(setLineStyle, { diagramId, id: rel.id, lineStyle: v as LineStyle })}
		class="grid grid-cols-4 overflow-hidden rounded-control border border-control-border"
		aria-label={t('inspector.lineStyle')}
	>
		{#each STYLES as style (style)}
			<ToggleGroup.Item
				value={style}
				aria-label={t(`lineStyle.${style}`)}
				title={styleTitle(style)}
				class="flex h-14 flex-col items-center justify-center gap-1 border-e border-control-border text-(length:--text-caption) text-chrome-muted last:border-e-0 hover:bg-chrome-bg data-[state=on]:bg-accent/10 data-[state=on]:font-semibold data-[state=on]:text-chrome-text"
			>
				<svg
					width="22"
					height="14"
					viewBox="0 0 22 14"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"><path d={STYLE_PATH[style]} /></svg
				>
				<span>{t(`lineStyle.${style}`)}</span>
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
	<StyleSection id={rel.id} keys={['line']} />

	<!-- Non-drag path for waypoints (accessibility.md: every drag has an equivalent). -->
	<div class="head mt-4">
		<SectionHeading first>{t('inspector.waypoints')}</SectionHeading>
		<Button size="sm" aria-label={t('inspector.addWaypoint')} onclick={addPoint}>
			<Icon name="plus" size={12} />{t('inspector.addShort')}
		</Button>
	</div>
	{#if layout.waypoints.length}
		<ul class="mt-1 flex flex-col gap-1">
			{#each layout.waypoints as w, i (i)}
				<li class="flex items-center gap-1">
					<Field
						type="number"
						class="w-20 min-w-0 flex-1"
						aria-label={t('inspector.waypointX', { n: i + 1 })}
						value={w.x}
						onchange={(e: Event) => movePoint(i, 'x', number(e))}
					/>
					<Field
						type="number"
						class="w-20 min-w-0 flex-1"
						aria-label={t('inspector.waypointY', { n: i + 1 })}
						value={w.y}
						onchange={(e: Event) => movePoint(i, 'y', number(e))}
					/>
					<IconButton
						label={t('inspector.removeWaypoint', { n: i + 1 })}
						icon="x"
						iconSize={12}
						stroke={2.5}
						size={24}
						class="text-danger"
						onclick={() => run(removeWaypoint, { diagramId, id: rel.id, index: i })}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-chrome-muted">{t('inspector.noWaypoints')}</p>
	{/if}

	{#if labelKeys.length}
		<div class="head mt-4">
			<SectionHeading first>{t('inspector.labels')}</SectionHeading>
			<!-- Its visible text is its name; disabled until a label has been moved. -->
			<Button size="sm" disabled={!anyMoved} onclick={resetLabels}>{t('inspector.resetAll')}</Button
			>
		</div>
		<div
			class="mt-1 grid grid-cols-[auto_1fr_56px_56px_24px] items-center gap-1 text-(length:--text-caption) text-chrome-muted"
			aria-hidden="true"
		>
			<span></span><span></span>
			<span class="px-1">{t('inspector.colDistance')}</span>
			<span class="px-1">{t('inspector.colAngle')}</span>
			<span></span>
		</div>
		<span class="sr-only" id="label-at-default">{t('inspector.labelAtDefault')}</span>
		<ul class="mt-1 flex flex-col gap-1">
			{#each labelKeys as l (l.key)}
				{@const name = labelName(l.key, l.at)}
				<li
					class="grid grid-cols-[auto_1fr_56px_56px_24px] items-center gap-1 text-(length:--text-small)"
				>
					<span>{l.lines.at(-1)}</span>
					<span class="truncate text-chrome-muted">{name}</span>
					<Field
						type="number"
						class="min-w-0 text-(length:--text-small) tabular-nums"
						aria-label={t('inspector.labelDistance', { label: name })}
						value={Math.round(offsetOf(l.key).distance)}
						onchange={(e: Event) => setOffset(l.key, { distance: number(e) })}
					/>
					<Field
						type="number"
						class="min-w-0 text-(length:--text-small) tabular-nums"
						aria-label={t('inspector.labelAngle', { label: name })}
						value={deg(offsetOf(l.key).alpha)}
						onchange={(e: Event) => setOffset(l.key, { degrees: number(e) })}
					/>
					<IconButton
						label={t('inspector.resetLabel', { label: name })}
						icon="undo"
						iconSize={13}
						size={24}
						aria-describedby={isDefault(l.key) ? 'label-at-default' : undefined}
						disabled={isDefault(l.key)}
						onclick={() => run(setLabelOffset, { diagramId, id: rel.id, key: l.key, offset: null })}
					/>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<Documentation id={rel.id} documentation={rel.documentation} field="rel-doc" />

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* A heading beside its action: no bottom gap of its own. */
	.head > :global(.section) {
		margin: 0;
	}
	/* Bits renders the items, so the chip rules are global, scoped by their class. */
	:global(.chip) {
		height: var(--control-min);
		padding: 0 var(--space-2);
		font-size: var(--text-caption);
		color: var(--chrome-muted);
		background: var(--chrome-bg);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
	}
	:global(.chip:hover) {
		color: var(--chrome-text);
	}
	:global(.chip[data-state='on']) {
		color: var(--chrome-text);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border-color: var(--accent);
	}
</style>
