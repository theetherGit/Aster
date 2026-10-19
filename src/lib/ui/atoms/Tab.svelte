<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';

	// Atom: one Bits tab trigger in the chrome's underline dress; Tabs.Root and Tabs.List stay
	// with the organism, since they are structure, not style.
	let {
		value,
		class: cls = '',
		children,
		...rest
	}: { value: string; class?: string; children: Snippet; [key: string]: unknown } = $props();
</script>

<Tabs.Trigger
	{value}
	class={cn(
		'h-(--control-bar) border-b-2 border-transparent px-2.5 text-(length:--text-body) text-chrome-muted disabled:opacity-50 data-[state=active]:border-accent data-[state=active]:text-chrome-text [[data-layout=classic]_&]:h-(--control-min) [[data-layout=classic]_&]:text-(length:--text-small)',
		cls
	)}
	{...rest}>{@render children()}</Tabs.Trigger
>
