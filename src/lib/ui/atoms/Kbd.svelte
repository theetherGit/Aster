<script lang="ts">
	import type { Snippet } from 'svelte';

	// Atom: a key cap. `quiet` is the inline hint in menus and buttons; the default is the cap
	// the shortcut sheet and the welcome draw.
	let {
		quiet = false,
		class: cls = '',
		children
	}: { quiet?: boolean; class?: string; children: Snippet } = $props();
</script>

<kbd class="kbd {cls}" class:quiet>{@render children()}</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		line-height: 1;
		white-space: nowrap;
		color: var(--chrome-text);
		background: var(--chrome-bg);
		border: 1px solid var(--chrome-border);
		border-bottom-width: 2px;
		border-radius: 4px;
	}
	.quiet {
		min-width: 0;
		height: auto;
		padding: 0;
		font-family: var(--font-chrome);
		color: var(--chrome-muted);
		background: none;
		border: 0;
	}
</style>
