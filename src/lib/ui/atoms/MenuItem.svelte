<script lang="ts">
	import { ContextMenu, DropdownMenu, Menubar } from 'bits-ui';
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';
	import { menuItem } from '../styles.ts';
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
		class: cls = '',
		children,
		...rest
	}: {
		kind?: 'dropdown' | 'context' | 'menubar';
		icon?: IconName;
		label?: string;
		keys?: string;
		disabled?: boolean;
		onSelect?: () => void;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
	const Item = $derived(
		kind === 'context' ? ContextMenu.Item : kind === 'menubar' ? Menubar.Item : DropdownMenu.Item
	);
</script>

<Item class={cn(menuItem, cls)} {disabled} {onSelect} {...rest}>
	{#if icon}<Icon name={icon} class="text-chrome-muted" />{/if}
	{#if children}{@render children()}{:else}<span>{label}</span>{/if}
	{#if keys}<Kbd quiet class="ms-auto">{keys}</Kbd>{/if}
</Item>
