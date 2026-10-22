<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Kbd from './Kbd.svelte';
	import { tooltip } from '../styles.ts';

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
		<Tooltip.Content class={tooltip} sideOffset={6}>
			<!-- Bits puts no role on the content; the tooltip role lives on the text it shows. -->
			<div role="tooltip" class="flex items-center gap-2">
				<span>{text}</span>{#if key}<Kbd>{key}</Kbd>{/if}
			</div>
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
