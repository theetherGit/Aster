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

<div class="flex items-center justify-between gap-2 ps-4 pe-2">
	<h2
		class="py-3 text-(length:--text-caption) font-semibold tracking-[0.05em] text-chrome-muted uppercase"
		{id}
	>
		{title}
	</h2>
	{#if children}{@render children()}{/if}
	<IconButton
		label={closeLabel}
		icon={closeIcon}
		key={closeKey}
		class="text-chrome-muted"
		onclick={onclose}
	/>
</div>
