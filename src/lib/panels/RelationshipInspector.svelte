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
	import Documentation from './Documentation.svelte';
	import FieldSelect from './FieldSelect.svelte';
	import Icon from './Icon.svelte';

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
		t('lineStyle.titled', { style: t(`lineStyle.${style}`), keys: t(`lineStyle.key.${style}`) });
	const endField = (field: string, end: 'source' | 'target') =>
		t('inspector.endField', {
			field,
			end: nameOf(end === 'source' ? rel.sourceId : rel.targetId)
		});
	const kindItems = KINDS.map((k) => ({ value: k, label: t(`ui.rel.${k}`) }));
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
<h2 class="section">{t(`ui.rel.${rel.relationshipKind}`)}</h2>
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
	<input
		id="rel-name"
		class="field"
		placeholder={t('vis.none')}
		value={rel.name ?? ''}
		onchange={(e) =>
			text(e.currentTarget.value) !== (rel.name ?? null) &&
			run(setRelationshipName, { id: rel.id, name: text(e.currentTarget.value) })}
	/>
	{#if !isAssociationKind(rel.relationshipKind)}
		<label for="rel-stereotype" class="text-chrome-muted">{t('inspector.stereotype')}</label>
		<span></span>
		<input
			id="rel-stereotype"
			class="field"
			placeholder={t('vis.none')}
			value={rel.stereotype ?? ''}
			onchange={(e) =>
				text(e.currentTarget.value) !== (rel.stereotype ?? null) &&
				run(setRelationshipStereotype, { id: rel.id, stereotype: text(e.currentTarget.value) })}
		/>
	{/if}
</div>

{#if ends.length}
	<h2 class="section mt-4">{t('inspector.ends')}</h2>
	<div class="grid grid-cols-[64px_1fr_1fr] items-center gap-x-2 gap-y-2 text-[12px]">
		<span></span>
		{#each ends as [end, , owner] (end)}<span class="truncate font-semibold" id="end-{end}"
				>{owner}</span
			>{/each}
		<span class="text-chrome-muted" id="ends-role">{t('inspector.role')}</span>
		{#each ends as [end, e] (end)}
			<input
				class="field min-w-0"
				aria-label={endField(t('inspector.role'), end)}
				id="{end}-role"
				placeholder={t('vis.none')}
				value={e.role ?? ''}
				onchange={(ev) => patchEnd(end, { role: text(ev.currentTarget.value) })}
			/>
		{/each}
		<span class="text-chrome-muted" id="ends-mult">{t('inspector.multiplicity')}</span>
		{#each ends as [end, e] (end)}
			<input
				class="field min-w-0"
				aria-label={endField(t('inspector.multiplicity'), end)}
				id="{end}-mult"
				value={e.multiplicity ?? ''}
				onchange={(ev) => patchEnd(end, { multiplicity: text(ev.currentTarget.value) })}
			/>
		{/each}
		<!-- Multiplicity presets (features list #11): one click, typing still allowed. -->
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
	<h2 class="section mt-4">{t('inspector.lineStyle')}</h2>
	<ToggleGroup.Root
		type="single"
		value={layout.lineStyle}
		onValueChange={(v: string) =>
			v &&
			v !== layout?.lineStyle &&
			run(setLineStyle, { diagramId, id: rel.id, lineStyle: v as LineStyle })}
		class="grid grid-cols-4 overflow-hidden rounded-control border border-chrome-border"
		aria-label={t('inspector.lineStyle')}
	>
		{#each STYLES as style (style)}
			<ToggleGroup.Item
				value={style}
				aria-label={t(`lineStyle.${style}`)}
				title={styleTitle(style)}
				class="flex h-14 flex-col items-center justify-center gap-1 border-r border-chrome-border text-[11px] text-chrome-muted last:border-r-0 hover:bg-chrome-bg data-[state=on]:bg-accent/10 data-[state=on]:font-semibold data-[state=on]:text-chrome-text"
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

	<!-- Non-drag path for waypoints (accessibility.md: every drag has an equivalent). -->
	<div class="mt-4 flex items-center justify-between">
		<h2 class="section mt-0">{t('inspector.waypoints')}</h2>
		<button
			type="button"
			class="h-7 rounded-control border border-chrome-border px-2 hover:bg-chrome-bg"
			aria-label={t('inspector.addWaypoint')}
			onclick={addPoint}
			><span class="inline-flex items-center gap-1"
				><Icon name="plus" size={12} />{t('inspector.addShort')}</span
			></button
		>
	</div>
	{#if layout.waypoints.length}
		<ul class="mt-1 flex flex-col gap-1">
			{#each layout.waypoints as w, i (i)}
				<li class="flex items-center gap-1">
					<input
						type="number"
						class="field w-20 min-w-0 flex-1"
						aria-label={t('inspector.waypointX', { n: i + 1 })}
						value={w.x}
						onchange={(e) => movePoint(i, 'x', e.currentTarget.valueAsNumber)}
					/>
					<input
						type="number"
						class="field w-20 min-w-0 flex-1"
						aria-label={t('inspector.waypointY', { n: i + 1 })}
						value={w.y}
						onchange={(e) => movePoint(i, 'y', e.currentTarget.valueAsNumber)}
					/>
					<button
						type="button"
						class="icon-btn h-6 w-6 text-danger"
						aria-label={t('inspector.removeWaypoint', { n: i + 1 })}
						onclick={() => run(removeWaypoint, { diagramId, id: rel.id, index: i })}
						><Icon name="x" size={12} stroke={2.5} /></button
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-chrome-muted">{t('inspector.noWaypoints')}</p>
	{/if}

	{#if labelKeys.length}
		<div class="mt-4 flex items-center justify-between">
			<h2 class="section mt-0">{t('inspector.labels')}</h2>
			<!-- Its visible text is its name; disabled until a label has been moved. -->
			<button
				type="button"
				class="h-7 rounded-control border border-chrome-border px-2 hover:bg-chrome-bg disabled:opacity-60"
				disabled={!anyMoved}
				onclick={resetLabels}>{t('inspector.resetAll')}</button
			>
		</div>
		<div
			class="mt-1 grid grid-cols-[auto_1fr_52px_52px_24px] items-center gap-1 text-[11px] text-chrome-muted"
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
				<li class="grid grid-cols-[auto_1fr_52px_52px_24px] items-center gap-1 text-[12px]">
					<span>{l.lines.at(-1)}</span>
					<span class="truncate text-chrome-muted">{name}</span>
					<input
						type="number"
						class="field h-6 min-w-0 px-1 text-[12px] tabular-nums"
						aria-label={t('inspector.labelDistance', { label: name })}
						value={Math.round(offsetOf(l.key).distance)}
						onchange={(e) => setOffset(l.key, { distance: e.currentTarget.valueAsNumber })}
					/>
					<input
						type="number"
						class="field h-6 min-w-0 px-1 text-[12px] tabular-nums"
						aria-label={t('inspector.labelAngle', { label: name })}
						value={deg(offsetOf(l.key).alpha)}
						onchange={(e) => setOffset(l.key, { degrees: e.currentTarget.valueAsNumber })}
					/>
					<button
						type="button"
						class="icon-btn h-6 w-6"
						aria-label={t('inspector.resetLabel', { label: name })}
						aria-describedby={isDefault(l.key) ? 'label-at-default' : undefined}
						disabled={isDefault(l.key)}
						onclick={() => run(setLabelOffset, { diagramId, id: rel.id, key: l.key, offset: null })}
					>
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4h4" /></svg
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<Documentation id={rel.id} documentation={rel.documentation} field="rel-doc" />

<style>
	/* Bits renders the items, so the chip rules are global, scoped by their class. */
	:global(.chip) {
		height: 24px;
		padding: 0 6px;
		font-size: 11px;
		color: var(--chrome-muted);
		background: var(--chrome-bg);
		border: 1px solid var(--chrome-border);
		border-radius: 999px;
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
