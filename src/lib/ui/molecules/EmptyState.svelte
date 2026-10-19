<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';
	import { hairline, type FigureFn } from '#lib/actions/hairline.ts';

	/**
	 * Molecule: an empty or placeholder state: a Hairline figure at rest above one heading, a line
	 * of description and one action (ui.md "States every panel must render"). `plate` names the
	 * background the figure sits on; Hairline fills its plates with that colour.
	 */
	interface Props {
		figure: FigureFn;
		title: string;
		description?: string;
		/** Accessible name of the figure; always meaningful, never decorative filler. */
		label: string;
		/** Figure width in CSS px (Hairline draws at 5:4). 200 in Modern, 160 where space is tight. */
		size?: number;
		plate?: 'surface' | 'bg' | 'paper';
		children?: Snippet;
		class?: string;
	}
	let {
		figure,
		title,
		description,
		label,
		size = 200,
		plate = 'surface',
		children,
		class: className = ''
	}: Props = $props();
	const PLATE = {
		surface: '[--hairline-plate:var(--chrome-surface)]',
		bg: '[--hairline-plate:var(--chrome-bg)]',
		paper: '[--hairline-plate:var(--paper-bg)]'
	};
</script>

<div class={cn('flex flex-col items-center text-center', PLATE[plate], className)}>
	<div
		class="max-w-full"
		style:width="{size}px"
		use:hairline={{ figure, label, intensity: 0.4, play: false }}
	></div>
	<p class="mt-3 text-(length:--text-lead) font-semibold text-chrome-text">{title}</p>
	{#if description}<p
			class="mt-1 max-w-[44ch] text-(length:--text-body) leading-[1.45] text-chrome-muted"
		>
			{description}
		</p>{/if}
	{#if children}<div class="mt-3.5">{@render children()}</div>{/if}
</div>
