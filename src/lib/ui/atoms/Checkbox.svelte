<script lang="ts">
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

<label class="row" class:disabled>
	<input
		type="checkbox"
		{id}
		bind:checked
		{disabled}
		aria-keyshortcuts={keys}
		onchange={(e) => onchange?.(e.currentTarget.checked)}
	/>
	<span class="min-w-0 flex-1">{label}</span>
	{#if trailing}{@render trailing()}{/if}
</label>

<style>
	.row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-height: var(--control-min);
		font-size: var(--text-body);
		color: var(--chrome-text);
	}
	.row input {
		width: 14px;
		height: 14px;
		margin: 0;
		accent-color: var(--accent);
	}
	.disabled {
		opacity: 0.5;
	}
</style>
