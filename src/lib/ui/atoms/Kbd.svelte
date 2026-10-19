<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: a key cap. `quiet` is the inline hint in menus and buttons; the default is the cap
	// the shortcut sheet and the welcome draw.
	let {
		quiet = false,
		class: cls = '',
		children
	}: { quiet?: boolean; class?: string; children: Snippet } = $props();
</script>

<kbd
	class={cn(
		quiet
			? 'font-sans text-(length:--text-caption) text-chrome-muted'
			: 'inline-flex h-[22px] min-w-[22px] items-center justify-center rounded border border-b-2 border-chrome-border bg-chrome-bg px-[5px] font-mono text-(length:--text-caption) leading-none whitespace-nowrap text-chrome-text',
		cls
	)}>{@render children()}</kbd
>
