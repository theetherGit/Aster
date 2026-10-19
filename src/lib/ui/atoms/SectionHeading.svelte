<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: the inspector's small-caps section title (boards 01, 13). `first` drops the top gap;
	// `inline` drops both margins for a heading that shares a row with an action.
	let {
		first = false,
		inline = false,
		id,
		class: cls = '',
		children
	}: {
		first?: boolean;
		inline?: boolean;
		id?: string;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<h2
	class={cn(
		'text-(length:--text-caption) font-semibold tracking-[0.04em] text-chrome-muted uppercase',
		inline ? 'm-0' : first ? 'mt-0 mb-1.5' : 'mt-6 mb-1.5',
		cls
	)}
	{id}
>
	{@render children()}
</h2>
