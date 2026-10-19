<script lang="ts">
	import { ContextMenu, DropdownMenu, Menubar } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Kbd from './Kbd.svelte';

	// Atom: one row of a Bits menu, the same dress whichever menu owns it: optional icon, label,
	// optional key at the end. `kind` picks the Bits item for the menu this row sits in.
	let {
		kind = 'dropdown',
		icon,
		label,
		keys,
		disabled = false,
		onSelect,
		children,
		...rest
	}: {
		kind?: 'dropdown' | 'context' | 'menubar';
		icon?: IconName;
		label?: string;
		keys?: string;
		disabled?: boolean;
		onSelect?: () => void;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
	const Item = $derived(
		kind === 'context' ? ContextMenu.Item : kind === 'menubar' ? Menubar.Item : DropdownMenu.Item
	);
</script>

<Item class="menu-item" {disabled} {onSelect} {...rest}>
	{#if icon}<Icon name={icon} class="text-chrome-muted" />{/if}
	{#if children}{@render children()}{:else}<span>{label}</span>{/if}
	{#if keys}<Kbd quiet class="ml-auto">{keys}</Kbd>{/if}
</Item>

<style>
	:global(.menu-item) {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		height: var(--control-icon);
		padding: 0 var(--space-2);
		font-size: var(--text-body);
		border-radius: 4px;
		cursor: default;
	}
	:global(.menu-item[data-highlighted]) {
		background: var(--selection-tint);
	}
	:global(.menu-item[data-disabled]) {
		opacity: 0.5;
	}
	@media (forced-colors: active) {
		:global(.menu-item[data-highlighted]) {
			color: HighlightText;
			background: Highlight;
		}
	}
</style>
