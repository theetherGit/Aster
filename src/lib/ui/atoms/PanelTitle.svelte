<script lang="ts">
	import type { Snippet } from 'svelte';

	// Atom: Classic's 24 px panel heading (board 03).
	let {
		id,
		class: cls = '',
		children
	}: { id?: string; class?: string; children: Snippet } = $props();
</script>

<h2 class="panel-title {cls}" {id}>{@render children()}</h2>

<style>
	.panel-title {
		display: flex;
		align-items: center;
		height: var(--control-min);
		padding: 0 10px;
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border-bottom: 1px solid var(--chrome-border);
	}
</style>
