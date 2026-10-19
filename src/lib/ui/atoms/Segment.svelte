<script lang="ts">
	import { ToggleGroup } from 'bits-ui';

	// Atom: a segmented control (Bits ToggleGroup, single). The on state is a tint, bold text and
	// an accent underline so it survives forced colours; the edge is a control edge (3:1).
	let {
		value = $bindable(''),
		items,
		label,
		disabled = false,
		fill = false,
		class: cls = '',
		onchange,
		...rest
	}: {
		value?: string;
		items: { value: string; label: string; keys?: string }[];
		label: string;
		disabled?: boolean;
		/** Stretch the items to share the width (the inspector's rows). */
		fill?: boolean;
		class?: string;
		onchange?: (value: string) => void;
		[key: `aria-${string}`]: string | undefined;
	} = $props();
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(v: string) => {
		if (!v) return;
		value = v;
		onchange?.(v);
	}}
	aria-label={label}
	{disabled}
	class="segment {fill ? 'fill' : ''} {cls}"
	{...rest}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item value={item.value} class="segment-item" aria-keyshortcuts={item.keys}
			>{item.label}</ToggleGroup.Item
		>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.segment) {
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(44px, auto);
		overflow: hidden;
		border: 1px solid var(--control-border);
		border-radius: var(--control-radius);
	}
	:global(.segment.fill) {
		display: grid;
		grid-auto-columns: 1fr;
	}
	:global(.segment-item) {
		height: var(--control-bar);
		padding: 0 var(--space-3);
		font-size: var(--text-body);
		color: var(--chrome-text);
	}
	:global(.segment-item + .segment-item) {
		border-left: 1px solid var(--chrome-border);
	}
	:global(.segment-item[data-state='on']) {
		font-weight: 600;
		color: var(--chrome-text);
		background: color-mix(in srgb, var(--accent) 14%, var(--chrome-surface));
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	:global(.segment[data-disabled]) {
		opacity: 0.5;
	}
	@media (forced-colors: active) {
		:global(.segment-item[data-state='on']) {
			outline: 2px solid Highlight;
			outline-offset: -2px;
		}
	}
</style>
