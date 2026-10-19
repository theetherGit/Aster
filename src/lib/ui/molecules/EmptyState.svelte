<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hairline, type FigureFn } from '#lib/actions/hairline.ts';

	/**
	 * An empty or placeholder state: a Hairline figure at rest above one heading, a line of
	 * description and one action (ui.md "States every panel must render"). `plate` names the
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
</script>

<div class="empty-state {className}" data-plate={plate}>
	<div
		class="figure"
		style:width="{size}px"
		use:hairline={{ figure, label, intensity: 0.4, play: false }}
	></div>
	<p class="title">{title}</p>
	{#if description}<p class="description">{description}</p>{/if}
	{#if children}<div class="action">{@render children()}</div>{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.empty-state[data-plate='bg'] {
		--hairline-plate: var(--chrome-bg);
	}
	.empty-state[data-plate='paper'] {
		--hairline-plate: var(--paper-bg);
	}
	.figure {
		max-width: 100%;
	}
	.title {
		margin-top: 12px;
		font-size: 15px;
		font-weight: 600;
		color: var(--chrome-text);
	}
	.description {
		margin-top: 4px;
		max-width: 44ch;
		font-size: 13px;
		line-height: 1.45;
		color: var(--chrome-muted);
	}
	.action {
		margin-top: 14px;
	}
</style>
