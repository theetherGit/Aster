<script lang="ts">
	import { Separator } from 'bits-ui';
	import { cn } from 'cn';

	// Atom: a 1 px rule (Bits Separator) between controls or sections.
	let {
		orientation = 'horizontal',
		class: cls = ''
	}: { orientation?: 'horizontal' | 'vertical'; class?: string } = $props();
</script>

<Separator.Root
	{orientation}
	class={cn(
		'shrink-0 bg-chrome-border',
		orientation === 'horizontal' ? 'h-px' : 'w-px self-stretch',
		cls
	)}
/>
