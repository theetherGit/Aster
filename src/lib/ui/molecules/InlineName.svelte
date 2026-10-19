<script lang="ts">
	import { cn } from 'cn';
	import { field } from '../styles.ts';

	// Molecule: one in-place name editor for the project name and the diagram tabs: Enter commits,
	// Esc reverts, leaving commits; a blank name is not a rename. `ondone` runs once, after either.
	let {
		value,
		label,
		class: cls = '',
		oncommit,
		ondone
	}: {
		value: string;
		label: string;
		class?: string;
		oncommit: (name: string) => void;
		ondone: () => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let draft = $state(value);
	let closed = false;
	function done(commit: boolean) {
		if (closed) return;
		closed = true;
		const name = draft.trim();
		if (commit && name && name !== value) oncommit(name);
		ondone();
	}
	function focus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') done(true);
		else if (e.key === 'Escape') done(false);
		else if (!e.metaKey && !e.ctrlKey) return e.stopPropagation();
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<input
	class={cn(field, cls)}
	type="text"
	aria-label={label}
	bind:value={draft}
	use:focus
	{onkeydown}
	onblur={() => done(true)}
/>
