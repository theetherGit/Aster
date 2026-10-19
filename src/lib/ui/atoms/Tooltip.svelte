<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';

	// One tooltip for every chrome control (CLAUDE rule 5): the label and its key, after ~600 ms on
	// hover and at once on focus, so keyboard users see the hint a `title` never showed them. The
	// Provider lives in +layout.svelte, so sliding between neighbours skips the delay.
	// The child snippet receives the trigger props to spread on the real button.
	let {
		text,
		key,
		children
	}: { text: string; key?: string; children: Snippet<[{ props: Record<string, unknown> }]> } =
		$props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}{@render children({ props })}{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content class="tip" sideOffset={6}>
			<!-- Bits puts no role on the content; the tooltip role lives on the text it shows. -->
			<div role="tooltip" class="flex items-center gap-2">
				<span>{text}</span>{#if key}<kbd>{key}</kbd>{/if}
			</div>
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>

<style>
	:global(.tip) {
		z-index: 60;
		display: flex;
		gap: 8px;
		align-items: center;
		max-width: 280px;
		padding: 4px 8px;
		font-size: 12px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-control);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.16);
	}
	:global(.tip kbd) {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--chrome-muted);
	}
</style>
