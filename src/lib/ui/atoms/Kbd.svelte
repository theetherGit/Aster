<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: a key (after shadcn-svelte's Kbd, in our tokens). The cap is every key in prose, hints,
	// buttons, tooltips, the shortcut sheet and empty states; `quiet` is the shortcut column of a
	// menu or the palette, the platform's menu convention. The cap reads --kbd-text / --kbd-fill /
	// --kbd-edge, which a surface may set (the paper, a primary button). `label` is what a screen
	// reader says when the cap is a glyph (↩ → "Enter").
	let {
		quiet = false,
		label,
		class: cls = '',
		children
	}: { quiet?: boolean; label?: string; class?: string; children: Snippet } = $props();
</script>

<kbd
	data-slot="kbd"
	class={cn(
		quiet
			? 'font-sans text-(length:--text-caption) whitespace-nowrap text-chrome-muted'
			: 'inline-flex h-(--space-5) min-w-(--space-5) items-center justify-center rounded-control border border-(color:--kbd-edge) bg-(--kbd-fill) px-1 font-sans text-(length:--text-caption) leading-none whitespace-nowrap text-(color:--kbd-text)',
		cls
	)}
	>{#if label}<span aria-hidden="true">{@render children()}</span><span class="sr-only"
			>{label}</span
		>{:else}{@render children()}{/if}</kbd
>
