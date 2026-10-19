<script lang="ts">
	import { cn } from 'cn';
	import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';
	import { field } from '../styles.ts';

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
	<!-- dir=auto: user text (names, UML lines) takes its direction from its own first letters,
	     so a UML line stays left to right in a right-to-left locale. -->
	<textarea
		dir="auto"
		class={cn(field, 'h-auto min-h-18 resize-y p-2 leading-[1.45]', cls)}
		bind:value
		{...rest as HTMLTextareaAttributes}></textarea>
{:else}
	<input dir="auto" class={cn(field, cls)} bind:value {...rest as HTMLInputAttributes} />
{/if}
