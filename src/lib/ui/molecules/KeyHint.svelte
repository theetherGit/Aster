<script lang="ts" module>
	/** A key as the hint draws it: the cap, and the words a screen reader says for a glyph. */
	export interface HintKey {
		cap: string;
		label?: string;
	}
</script>

<script lang="ts">
	import Kbd from '../atoms/Kbd.svelte';

	// Molecule: a message whose {placeholders} are keys, drawn as caps, so hints never spell keys
	// in their copy ("{enter} next line · {tab} operations · {esc} done"). Callers format the keys
	// (app/shortcuts.ts); a placeholder with no key stays as written.
	let {
		text,
		keys,
		class: cls
	}: { text: string; keys: Record<string, HintKey>; class?: string } = $props();
	const parts = $derived(text.split(/\{(\w+)\}/));
</script>

<span class={cls}
	>{#each parts as part, i (i)}{#if i % 2 === 0}{part}{:else if keys[part]}<Kbd
				label={keys[part].label}>{keys[part].cap}</Kbd
			>{:else}{`{${part}}`}{/if}{/each}</span
>
