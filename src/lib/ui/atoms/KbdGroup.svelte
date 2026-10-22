<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: keys that go together (↑ ↓, or two chords for one action), a cap's width apart. A <kbd>
	// holding <kbd>s is HTML's own way to say "these keys".
	let { class: cls = '', children }: { class?: string; children: Snippet } = $props();
</script>

<kbd data-slot="kbd-group" class={cn('inline-flex items-center gap-1 font-sans', cls)}
	>{@render children()}</kbd
>
