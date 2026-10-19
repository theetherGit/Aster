<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: Classic's 24 px panel heading (board 03), sticky so it stays put while its panel scrolls.
	let {
		id,
		class: cls = '',
		children
	}: { id?: string; class?: string; children: Snippet } = $props();
</script>

<h2
	class={cn(
		'sticky top-0 z-2 flex h-(--control-min) items-center border-b border-chrome-border bg-chrome-surface px-2.5 text-(length:--text-small) font-semibold text-chrome-text',
		cls
	)}
	{id}
>
	{@render children()}
</h2>
