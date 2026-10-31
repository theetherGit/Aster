<script lang="ts">
	import { hintKey } from '#lib/app/shortcuts.ts';
	import { resizeTo } from '#lib/canvas/actions.ts';
	import { leastSize } from '#lib/canvas/resize.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Id } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import KeyHint from '#lib/ui/molecules/KeyHint.svelte';

	// A box's size, the non-drag path beside the corner handle and ⇧+arrows (accessibility.md); the
	// same section for notes, packages, classes and objects. A class or an object whose height
	// follows its content shows its height empty, "Auto", until one is set.
	let { id }: { id: Id } = $props();
	const kind = $derived(projectStore.project.elements.get(id)?.kind);
	const min = $derived(leastSize(kind));
	const size = $derived.by(() => {
		void projectStore.version;
		const d = projectStore.diagram;
		const l = d.layout.get(id);
		if (l?.kind !== 'node') return null;
		const follows =
			(kind === 'classifier' || kind === 'instance') &&
			{ ...d.defaults, ...l.flags }.autoResize !== false;
		return { w: Math.max(min.w, l.w), h: follows ? null : Math.max(min.h, l.h) };
	});
	/** Below the least or not a number: the field goes back to the box's value. */
	function commit(axis: 'w' | 'h', input: HTMLInputElement) {
		if (!size) return;
		const v = Math.round(input.valueAsNumber);
		if (!Number.isFinite(v) || v < min[axis]) {
			input.value = size[axis] === null ? '' : String(size[axis]);
			return;
		}
		if (axis === 'w') resizeTo(id, size.h === null ? { w: v } : { w: v, h: size.h });
		else resizeTo(id, { w: size.w, h: v });
	}
</script>

{#if size}
	<SectionHeading>{t('note.size')}</SectionHeading>
	<div class="grid grid-cols-2 gap-3">
		<label class="text-chrome-muted"
			>{t('note.width')}<Field
				type="number"
				min={min.w}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={size.w}
				onchange={(e: Event) => commit('w', e.currentTarget as HTMLInputElement)}
			/></label
		>
		<label class="text-chrome-muted"
			>{t('note.height')}<Field
				type="number"
				min={min.h}
				step="1"
				class="mt-1 w-full tabular-nums"
				value={size.h ?? ''}
				placeholder={t('size.auto')}
				onchange={(e: Event) => commit('h', e.currentTarget as HTMLInputElement)}
			/></label
		>
	</div>
	<p class="mt-1 text-(length:--text-small) text-chrome-muted">
		<KeyHint
			text={t('note.sizeHint', { w: min.w, h: min.h })}
			keys={{ shift: hintKey('⇧'), arrows: hintKey('Arrows') }}
		/>
	</p>
{/if}
