<script lang="ts">
	import { cn } from 'cn';
	import type { HTMLInputAttributes } from 'svelte/elements';

	// Atom: the native colour picker as a 28 px swatch in the field dress. Callers commit on
	// `onchange` (the picker closing), never `oninput`, so a sweep through the picker is one step.
	let { class: cls = '', ...rest }: Omit<HTMLInputAttributes, 'type'> & { class?: string } =
		$props();
</script>

<input
	type="color"
	class={cn(
		'box-border size-(--control-icon) shrink-0 cursor-pointer appearance-none rounded-control border border-control-border bg-chrome-bg p-0.5 hover:enabled:border-accent disabled:cursor-default disabled:opacity-50',
		'[&::-moz-color-swatch]:rounded-[inherit] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[inherit] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0',
		cls
	)}
	{...rest}
/>
