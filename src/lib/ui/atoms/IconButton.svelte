<script lang="ts">
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
</script>

{#snippet button(props: Record<string, unknown>)}
	<button
		type="button"
		class="icon-btn {cls}"
		class:dense={size === 24}
		aria-label={label}
		{...props}
		{...rest}
	>
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

<style>
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-icon);
		height: var(--control-icon);
		color: var(--chrome-text);
		border-radius: var(--control-radius);
	}
	.dense {
		width: var(--control-min);
		height: var(--control-min);
	}
	.icon-btn:hover:not(:disabled):not([aria-disabled]) {
		background: var(--chrome-surface);
	}
	.icon-btn:disabled,
	.icon-btn[aria-disabled='true'] {
		color: var(--chrome-muted);
		opacity: 0.6;
	}
</style>
