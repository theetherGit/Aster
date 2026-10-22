<script lang="ts">
	import { INK, PAPER, contrast, fillOf, lineOf } from '#lib/canvas/paint.ts';
	import { setColour } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Id } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import ColourInput from '#lib/ui/atoms/ColourInput.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';

	// features.md M3, "Fill and line colour" (StarUML's Style Editor): this view's own colours,
	// each change one undo step. "Default" is the paper's, which StarUML writes as #ffffff / #000000.
	let { id, keys }: { id: Id; keys: ('fill' | 'line')[] } = $props();

	const paint = $derived.by(() => {
		void projectStore.version;
		const l = projectStore.diagram.layout.get(id) as { fill?: string; line?: string } | undefined;
		return { fill: fillOf(l), line: lineOf(l) };
	});
	const DEFAULT = { fill: PAPER, line: INK };
	const set = (key: 'fill' | 'line', colour: string | null) =>
		projectStore.run(setColour, { diagramId: projectStore.activeDiagramId, id, key, colour });
	const ratio = (r: number) => (Math.floor(r * 10) / 10).toFixed(1);
	// Text on the fill needs 4.5:1, a line on white 3:1 (CLAUDE.md rule 4); said, never refused.
	const warnings = $derived([
		...(keys.includes('fill') && paint.fill && contrast(paint.fill, INK) < 4.5
			? [t('style.lowFill', { ratio: ratio(contrast(paint.fill, INK)) })]
			: []),
		...(keys.includes('line') && paint.line && contrast(paint.line, PAPER) < 3
			? [t('style.lowLine', { ratio: ratio(contrast(paint.line, PAPER)) })]
			: [])
	]);
</script>

<SectionHeading>{t('style.heading')}</SectionHeading>
<div class="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 gap-y-1">
	{#each keys as key (key)}
		{@const own = paint[key]}
		<label for="style-{key}" class="pe-2 text-chrome-muted">{t(`style.${key}`)}</label>
		<ColourInput
			id="style-{key}"
			value={own ?? DEFAULT[key]}
			onchange={(e: Event) => {
				const v = (e.currentTarget as HTMLInputElement).value.toLowerCase();
				if (v !== (own ?? DEFAULT[key])) set(key, v);
			}}
		/>
		<span
			class="min-w-0 truncate tabular-nums {own ? 'text-chrome-text' : 'text-chrome-muted'}"
			data-testid="style-{key}-value">{own ?? t('style.default')}</span
		>
		{#if own}
			<Button
				variant="ghost"
				size="sm"
				aria-label={t('style.resetLabel', { what: t(`style.${key}`).toLowerCase() })}
				onclick={() => set(key, null)}>{t('style.reset')}</Button
			>
		{:else}
			<span></span>
		{/if}
	{/each}
</div>
{#each warnings as w (w)}
	<p class="mt-1 flex items-baseline gap-2 text-(length:--text-small) text-chrome-muted">
		<span class="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true"></span>{w}
	</p>
{/each}
{#if ui.theme === 'high-contrast' && (paint.fill || paint.line)}
	<p class="mt-1 text-(length:--text-small) text-chrome-muted">{t('style.hcHidden')}</p>
{/if}
