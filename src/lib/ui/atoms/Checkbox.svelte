<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: a native checkbox in a 24 px row with its visible label (CLAUDE rule 4); `keys` is the
	// aria-keyshortcuts the row answers to and `trailing` is for a key cap or a marker at the end.
	let {
		checked = $bindable(false),
		label,
		id,
		keys,
		disabled = false,
		onchange,
		trailing
	}: {
		checked?: boolean;
		label: string;
		id?: string;
		keys?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
		trailing?: Snippet;
	} = $props();
</script>

<label
	class={cn(
		'flex min-h-(--control-min) items-center gap-2 text-(length:--text-body) text-chrome-text',
		disabled && 'opacity-50'
	)}
>
	<input
		type="checkbox"
		class="m-0 size-3.5 accent-accent"
		{id}
		bind:checked
		{disabled}
		aria-keyshortcuts={keys}
		onchange={(e) => onchange?.(e.currentTarget.checked)}
	/>
	<span class="min-w-0 flex-1">{label}</span>
	{#if trailing}{@render trailing()}{/if}
</label>
