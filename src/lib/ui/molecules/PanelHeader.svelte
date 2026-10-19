<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from '../atoms/IconButton.svelte';
	import type { IconName } from '../atoms/Icon.svelte';

	// Molecule: a Modern panel's head: small-caps title on the left, its close button on the
	// right (the mirror of the rail that brings the panel back), anything else in between.
	let {
		title,
		id,
		closeLabel,
		closeIcon = 'x',
		closeKey,
		onclose,
		children
	}: {
		title: string;
		id?: string;
		closeLabel: string;
		closeIcon?: IconName;
		closeKey?: string;
		onclose: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="head">
	<h2 class="title" {id}>{title}</h2>
	{#if children}{@render children()}{/if}
	<IconButton
		label={closeLabel}
		icon={closeIcon}
		key={closeKey}
		class="text-chrome-muted"
		onclick={onclose}
	/>
</div>

<style>
	.head {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2) 0 var(--space-4);
	}
	.title {
		padding: var(--space-3) 0;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.05em;
		color: var(--chrome-muted);
		text-transform: uppercase;
	}
</style>
