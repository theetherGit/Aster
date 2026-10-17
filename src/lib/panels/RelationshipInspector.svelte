<script lang="ts">
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
	import { elementName } from '#lib/model/project.ts';
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
	import FieldSelect from './FieldSelect.svelte';

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
	const STYLES: LineStyle[] = ['rectilinear', 'oblique', 'roundrect', 'curve'];
	const kindItems = KINDS.map((k) => ({ value: k, label: t(`ui.rel.${k}`) }));
	const styleItems = STYLES.map((s) => ({ value: s, label: t(`lineStyle.${s}`) }));
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
	const labelKeys = $derived(labelsFor(rel, projectStore.diagram.defaults).map((l) => l.key));
	const offsetOf = (key: LabelKey) => layout?.labelOffsets[key] ?? DEFAULT_OFFSETS[key];
	const deg = (rad: number) => Math.round((rad * 180) / Math.PI);

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
			label: t('cmd.setLabelOffset', { name: elementName(rel) }),
			commands: keys.map((key) =>
				serialise(setLabelOffset(p, { diagramId, id: rel.id, key, offset: null }))
			)
		});
	}
	function addPoint() {
		if (!layout) return;
		// Half way between the last waypoint (or the source) and the target, by layout position.
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

<div class="grid grid-cols-[88px_1fr] items-center gap-x-2 gap-y-2">
	<label for="rel-kind">{t('inspector.kind')}</label>
	<FieldSelect
		id="rel-kind"
		value={rel.relationshipKind}
		items={kindItems}
		onchange={(v) =>
			run(setRelationshipKind, { id: rel.id, relationshipKind: v as RelationshipKind })}
	/>

	<label for="rel-name">{t('inspector.name')}</label>
	<input
		id="rel-name"
		class="field"
		value={rel.name ?? ''}
		onchange={(e) =>
			text(e.currentTarget.value) !== (rel.name ?? null) &&
			run(setRelationshipName, { id: rel.id, name: text(e.currentTarget.value) })}
	/>

	<label for="rel-stereotype">{t('inspector.stereotype')}</label>
	<input
		id="rel-stereotype"
		class="field"
		value={rel.stereotype ?? ''}
		onchange={(e) =>
			text(e.currentTarget.value) !== (rel.stereotype ?? null) &&
			run(setRelationshipStereotype, { id: rel.id, stereotype: text(e.currentTarget.value) })}
	/>

	{#if layout}
		<label for="rel-style">{t('inspector.lineStyle')}</label>
		<FieldSelect
			id="rel-style"
			value={layout.lineStyle}
			items={styleItems}
			onchange={(v) => run(setLineStyle, { diagramId, id: rel.id, lineStyle: v as LineStyle })}
		/>
	{/if}
</div>

{#each ends as [end, e, owner] (end)}
	<fieldset class="mt-4 grid grid-cols-[88px_1fr] items-center gap-x-2 gap-y-2">
		<legend class="mb-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
			>{t('inspector.end', { name: owner })}</legend
		>
		<label for="{end}-role">{t('inspector.role')}</label>
		<input
			id="{end}-role"
			class="field"
			value={e.role ?? ''}
			onchange={(ev) => patchEnd(end, { role: text(ev.currentTarget.value) })}
		/>
		<label for="{end}-mult">{t('inspector.multiplicity')}</label>
		<input
			id="{end}-mult"
			class="field font-mono"
			value={e.multiplicity ?? ''}
			onchange={(ev) => patchEnd(end, { multiplicity: text(ev.currentTarget.value) })}
		/>
		<label for="{end}-nav">{t('inspector.navigability')}</label>
		<FieldSelect
			id="{end}-nav"
			value={e.navigable}
			items={navItems}
			onchange={(v) => patchEnd(end, { navigable: v as End['navigable'] })}
		/>
		<label for="{end}-vis">{t('inspector.visibility')}</label>
		<FieldSelect
			id="{end}-vis"
			value={e.visibility ?? 'none'}
			items={visItems}
			onchange={(v) => patchEnd(end, { visibility: v === 'none' ? null : (v as Visibility) })}
		/>
	</fieldset>
{/each}

{#if layout}
	<!-- Non-drag path for waypoints (accessibility.md: every drag has an equivalent). -->
	<fieldset class="mt-4 min-w-0">
		<legend class="mb-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
			>{t('inspector.waypoints')}</legend
		>
		<ul class="flex flex-col gap-1">
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
						onclick={() => run(removeWaypoint, { diagramId, id: rel.id, index: i })}>×</button
					>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			class="mt-1 h-7 rounded-control border border-chrome-border px-2 hover:bg-chrome-bg"
			onclick={addPoint}>+ {t('inspector.addWaypoint')}</button
		>
	</fieldset>

	{#if labelKeys.length}
		<!-- Non-drag path for label positions. -->
		<fieldset class="mt-4 min-w-0">
			<legend class="mb-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
				>{t('inspector.labels')}</legend
			>
			<ul class="flex flex-col gap-1">
				{#each labelKeys as key (key)}
					<li class="grid grid-cols-[1fr_64px_64px] items-center gap-1">
						<span class="truncate">{t(`label.${key}`)}</span>
						<input
							type="number"
							class="field min-w-0"
							aria-label={t('inspector.labelDistance', { label: t(`label.${key}`) })}
							value={Math.round(offsetOf(key).distance)}
							onchange={(e) => setOffset(key, { distance: e.currentTarget.valueAsNumber })}
						/>
						<input
							type="number"
							class="field min-w-0"
							aria-label={t('inspector.labelAngle', { label: t(`label.${key}`) })}
							value={deg(offsetOf(key).alpha)}
							onchange={(e) => setOffset(key, { degrees: e.currentTarget.valueAsNumber })}
						/>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				class="mt-1 h-7 rounded-control border border-chrome-border px-2 hover:bg-chrome-bg"
				onclick={resetLabels}>{t('inspector.resetLabels')}</button
			>
		</fieldset>
	{/if}
{/if}
