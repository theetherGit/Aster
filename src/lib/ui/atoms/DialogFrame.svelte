<script lang="ts">
	import { AlertDialog, Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';

	// Atom: the sheet every dialog shares (Bits Dialog, or AlertDialog for a question that must be
	// answered): dimmed overlay, centred surface, title, optional description, body, action row.
	let {
		open = $bindable(false),
		alert = false,
		title,
		description,
		width = 460,
		onOpenAutoFocus,
		children,
		actions,
		class: cls = ''
	}: {
		open?: boolean;
		alert?: boolean;
		title: string;
		description?: string;
		width?: number;
		onOpenAutoFocus?: (e: Event) => void;
		children?: Snippet;
		actions?: Snippet;
		class?: string;
	} = $props();
	const D = $derived(alert ? AlertDialog : Dialog);
</script>

<D.Root bind:open>
	<D.Portal>
		<D.Overlay class="dim" />
		<D.Content
			class="sheet {cls}"
			style="width: {width}px"
			aria-describedby={description ? undefined : undefined}
			{onOpenAutoFocus}
		>
			<D.Title class="sheet-title">{title}</D.Title>
			{#if description}
				<D.Description class="sheet-description">{description}</D.Description>
			{/if}
			{#if children}{@render children()}{/if}
			{#if actions}
				<div class="sheet-actions">{@render actions()}</div>
			{/if}
		</D.Content>
	</D.Portal>
</D.Root>

<style>
	:global(.dim) {
		position: fixed;
		inset: 0;
		z-index: var(--z-dialog);
		background: rgb(0 0 0 / 0.45);
	}
	:global(.sheet) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: var(--z-dialog);
		max-width: calc(100vw - 32px);
		padding: var(--space-6);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-dialog);
		transform: translate(-50%, -50%);
	}
	:global(.sheet-title) {
		font-size: var(--text-title);
		font-weight: 600;
	}
	:global(.sheet-description) {
		margin-top: var(--space-2);
		font-size: var(--text-field);
		line-height: 1.5;
		color: var(--chrome-muted);
	}
	:global(.sheet-actions) {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		justify-content: flex-end;
		margin-top: var(--space-5);
	}
</style>
