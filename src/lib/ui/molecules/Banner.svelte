<script lang="ts">
	import { cn } from 'cn';
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

<div
	class={cn(
		'absolute inset-x-0 top-0 z-(--z-banner) flex items-center gap-2.5 border-b border-chrome-border px-3.5 py-1.5 text-(length:--text-body) text-chrome-text',
		tone === 'warning'
			? 'bg-[color-mix(in_srgb,var(--warning)_22%,var(--chrome-surface))]'
			: 'bg-[color-mix(in_srgb,var(--accent)_14%,var(--chrome-surface))]'
	)}
	role="region"
	aria-label={label}
>
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
