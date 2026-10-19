<script lang="ts">
	import { cn } from 'cn';

	// Atom: a visually hidden skip link that shows on focus (accessibility.md: "every panel has a
	// visually hidden skip link as its first focusable"). A real <a href>; activating it runs `go`.
	let { label, go, class: cls = '' }: { label: string; go: () => void; class?: string } = $props();
</script>

<a
	href="#canvas"
	class={cn(
		'sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:start-2 focus-visible:top-2 focus-visible:z-(--z-drop) focus-visible:rounded-control focus-visible:border focus-visible:border-chrome-border focus-visible:bg-chrome-surface focus-visible:px-2.5 focus-visible:py-1.5 focus-visible:text-chrome-text focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-dashed',
		cls
	)}
	onclick={(e) => {
		e.preventDefault();
		go();
	}}>{label}</a
>
