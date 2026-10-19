<script lang="ts">
	import { cn } from 'cn';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';

	// Atom: a square icon-only button, 28 px (24 px in dense rows), named by `label`, with the
	// Bits tooltip that shows the label and its key on hover and at once on focus. `tip={false}`
	// drops the tooltip where a row already explains the button.
	let {
		label,
		icon,
		key,
		size = 28,
		iconSize = 14,
		stroke = 2,
		tip = true,
		class: cls = '',
		...rest
	}: HTMLButtonAttributes & {
		label: string;
		icon: IconName;
		key?: string;
		size?: 24 | 28;
		iconSize?: number;
		stroke?: number;
		tip?: boolean;
	} = $props();
	const classes = $derived(
		cn(
			'inline-flex items-center justify-center rounded-control text-chrome-text hover:enabled:bg-chrome-surface disabled:text-chrome-muted disabled:opacity-60 aria-disabled:text-chrome-muted aria-disabled:opacity-60',
			size === 24 ? 'size-(--control-min)' : 'size-(--control-icon)',
			cls
		)
	);
</script>

{#snippet button(props: Record<string, unknown>)}
	<button type="button" class={classes} aria-label={label} {...props} {...rest}>
		<Icon name={icon} size={iconSize} {stroke} />
	</button>
{/snippet}

{#if tip}
	<Tooltip text={label} {key}>
		{#snippet children({ props })}{@render button(props)}{/snippet}
	</Tooltip>
{:else}
	{@render button({})}
{/if}
