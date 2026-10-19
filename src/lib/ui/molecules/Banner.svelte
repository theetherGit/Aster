<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from '../atoms/IconButton.svelte';

	// Molecule: a one-line strip under the top bar (ui.md save states, board 23): a message, its
	// actions, a dismiss. `tone` tints it amber for a warning or accent for information.
	let {
		text,
		label,
		tone = 'warning',
		dismissLabel,
		ondismiss,
		actions
	}: {
		text: string;
		label: string;
		tone?: 'warning' | 'info';
		dismissLabel: string;
		ondismiss: () => void;
		actions?: Snippet;
	} = $props();
</script>

<div class="banner {tone}" role="region" aria-label={label}>
	<span class="flex-1">{text}</span>
	{#if actions}{@render actions()}{/if}
	<IconButton
		label={dismissLabel}
		icon="x"
		iconSize={12}
		stroke={2.5}
		tip={false}
		onclick={ondismiss}
	/>
</div>

<style>
	.banner {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		z-index: var(--z-banner);
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 6px 14px;
		font-size: var(--text-body);
		color: var(--chrome-text);
		border-bottom: 1px solid var(--chrome-border);
	}
	.warning {
		background: color-mix(in srgb, var(--warning) 22%, var(--chrome-surface));
	}
	.info {
		background: color-mix(in srgb, var(--accent) 14%, var(--chrome-surface));
	}
</style>
