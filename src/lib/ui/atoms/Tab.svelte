<script lang="ts">
	import { Tabs } from 'bits-ui';
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

<Tabs.Trigger {value} class="tab {cls}" {...rest}>{@render children()}</Tabs.Trigger>

<style>
	:global(.tab) {
		height: var(--control-bar);
		padding: 0 10px;
		font-size: var(--text-body);
		color: var(--chrome-muted);
		border-bottom: 2px solid transparent;
	}
	:global(.tab[data-state='active']) {
		color: var(--chrome-text);
		border-bottom-color: var(--accent);
	}
	:global(.tab:disabled) {
		opacity: 0.5;
	}
	:global(:root[data-layout='classic'] .tab) {
		height: var(--control-min);
		font-size: var(--text-small);
	}
</style>
