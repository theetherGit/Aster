<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { cn } from 'cn';

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
	class={cn(
		'overflow-hidden rounded-control border border-control-border data-[disabled]:opacity-50',
		fill
			? 'grid auto-cols-fr grid-flow-col'
			: 'inline-grid auto-cols-[minmax(44px,auto)] grid-flow-col',
		cls
	)}
	{...rest}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class="h-(--control-bar) px-3 text-(length:--text-body) text-chrome-text not-first:border-l not-first:border-chrome-border data-[state=on]:bg-[color-mix(in_srgb,var(--accent)_14%,var(--chrome-surface))] data-[state=on]:font-semibold data-[state=on]:shadow-[inset_0_-2px_0_var(--accent)] forced-colors:data-[state=on]:outline-2 forced-colors:data-[state=on]:-outline-offset-2 forced-colors:data-[state=on]:outline-[Highlight]"
			aria-keyshortcuts={item.keys}>{item.label}</ToggleGroup.Item
		>
	{/each}
</ToggleGroup.Root>
