<script lang="ts">
	import type { Snippet } from 'svelte';

	// Atom: the inspector's small-caps section title (boards 01, 13). `first` drops the top gap.
	let {
		first = false,
		id,
		class: cls = '',
		children
	}: { first?: boolean; id?: string; class?: string; children: Snippet } = $props();
</script>

<h2 class="section {cls}" class:first {id}>{@render children()}</h2>

<style>
	.section {
		margin: var(--space-6) 0 6px;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--chrome-muted);
		text-transform: uppercase;
	}
	.first {
		margin-top: 0;
	}
</style>
