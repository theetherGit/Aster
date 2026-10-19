<script lang="ts">
	import { Select } from 'bits-ui';

	interface Props {
		id?: string;
		value: string;
		items: { value: string; label: string }[];
		onchange: (value: string) => void;
		/** Rendered as a visually hidden label; the trigger's visible value stays part of its name. */
		ariaLabel?: string;
		class?: string;
	}
	const uid = $props.id();
	let { id = uid, value, items, onchange, ariaLabel, class: className = '' }: Props = $props();
	const current = $derived(items.find((i) => i.value === value)?.label ?? '');
</script>

<!-- A Bits UI Select styled as a form field; label it with <label for={id}> or ariaLabel. -->
{#if ariaLabel}
	<span class="sr-only" id="{id}-label">{ariaLabel}</span>
{/if}
<Select.Root
	type="single"
	{value}
	{items}
	onValueChange={(v: string) => {
		if (v && v !== value) onchange(v);
	}}
>
	<Select.Trigger
		{id}
		aria-labelledby={ariaLabel ? `${id}-label ${id}` : undefined}
		class="field truncate text-left whitespace-nowrap {className}">{current}</Select.Trigger
	>
	<Select.Portal>
		<Select.Content class="menu" sideOffset={4}>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item value={item.value} label={item.label} class="menu-item"
						>{item.label}</Select.Item
					>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
