<script lang="ts">
	import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';

	// Atom: a real <input> or <textarea> in the chrome's field dress. Uncontrolled by default
	// (callers commit on `onchange`); `bind:value` works when a caller wants it live.
	let {
		multiline = false,
		value = $bindable(),
		class: cls = '',
		...rest
	}: (HTMLInputAttributes | HTMLTextareaAttributes) & {
		multiline?: boolean;
		class?: string;
	} = $props();
</script>

{#if multiline}
	<textarea class="field area {cls}" bind:value {...rest as HTMLTextareaAttributes}></textarea>
{:else}
	<input class="field {cls}" bind:value {...rest as HTMLInputAttributes} />
{/if}

<style>
	.field {
		box-sizing: border-box;
		height: var(--control-icon);
		padding: 0 var(--space-2);
		font-size: var(--text-body);
		color: var(--chrome-text);
		background: var(--chrome-bg);
		border: 1px solid var(--control-border);
		border-radius: var(--control-radius);
	}
	.area {
		height: auto;
		min-height: 72px;
		padding: var(--space-2);
		line-height: 1.45;
		resize: vertical;
	}
	.field::placeholder {
		color: var(--chrome-muted);
	}
	.field:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 0;
	}
	.field:disabled {
		opacity: 0.5;
	}
</style>
