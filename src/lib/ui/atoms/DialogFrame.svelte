<script lang="ts">
	import { AlertDialog, Dialog } from 'bits-ui';
	import { cn } from 'cn';
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
		<D.Overlay class="fixed inset-0 z-(--z-dialog) bg-black/45" />
		<D.Content
			class={cn(
				'fixed top-1/2 left-1/2 z-(--z-dialog) max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-chrome-border bg-chrome-surface p-6 text-chrome-text shadow-dialog',
				cls
			)}
			style="width: {width}px"
			{onOpenAutoFocus}
		>
			<D.Title class="text-(length:--text-title) font-semibold">{title}</D.Title>
			{#if description}
				<D.Description class="mt-2 text-(length:--text-field) leading-normal text-chrome-muted"
					>{description}</D.Description
				>
			{/if}
			{#if children}{@render children()}{/if}
			{#if actions}
				<div class="mt-5 flex items-center justify-end gap-2">{@render actions()}</div>
			{/if}
		</D.Content>
	</D.Portal>
</D.Root>
