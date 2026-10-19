<script lang="ts">
	import { Separator } from 'bits-ui';

	// Atom: a 1 px rule (Bits Separator) between controls or sections.
	let {
		orientation = 'horizontal',
		class: cls = ''
	}: { orientation?: 'horizontal' | 'vertical'; class?: string } = $props();
</script>

<Separator.Root {orientation} class="rule {orientation} {cls}" />

<style>
	:global(.rule) {
		flex-shrink: 0;
		background: var(--chrome-border);
	}
	:global(.rule.horizontal) {
		height: 1px;
	}
	:global(.rule.vertical) {
		width: 1px;
		align-self: stretch;
	}
</style>
