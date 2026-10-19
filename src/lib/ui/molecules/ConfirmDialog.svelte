<script lang="ts">
	import Button from '../atoms/Button.svelte';
	import DialogFrame from '../atoms/DialogFrame.svelte';
	import Field from '../atoms/Field.svelte';

	// Molecule: "type the name to confirm" (after shadcn-svelte-extras' confirm-delete dialog, on
	// Bits AlertDialog): the confirm button wakes only when the typed text matches `name`.
	let {
		open = $bindable(false),
		name,
		title,
		description,
		prompt,
		cancelLabel,
		confirmLabel,
		onconfirm
	}: {
		open?: boolean;
		name: string;
		title: string;
		description: string;
		prompt: string;
		cancelLabel: string;
		confirmLabel: string;
		onconfirm: () => void;
	} = $props();
	let typed = $state('');
	const matches = $derived(typed.trim() === name);
	$effect(() => {
		if (!open) typed = '';
	});
	function confirm() {
		if (!matches) return;
		open = false;
		onconfirm();
	}
	const focusField = (e: Event) => {
		// The field takes focus once mounted; Bits' own first-tabbable pass can run early.
		e.preventDefault();
		requestAnimationFrame(() =>
			requestAnimationFrame(() => document.getElementById('confirm-name')?.focus())
		);
	};
</script>

<DialogFrame bind:open alert {title} {description} onOpenAutoFocus={focusField}>
	<form
		class="mt-4"
		onsubmit={(e) => {
			e.preventDefault();
			confirm();
		}}
	>
		<label for="confirm-name" class="mb-1 block text-[13px] text-chrome-muted">{prompt}</label>
		<Field
			id="confirm-name"
			class="h-9 w-full text-[14px]"
			autocomplete="off"
			spellcheck={false}
			bind:value={typed}
		/>
		<div class="sheet-actions">
			<!-- type=button: inside the form, Enter must reach the confirm, not the first button. -->
			<Button variant="ghost" onclick={() => (open = false)}>{cancelLabel}</Button>
			<button type="submit" class="btn danger" disabled={!matches} data-testid="confirm-delete"
				>{confirmLabel}</button
			>
		</div>
	</form>
</DialogFrame>

<style>
	.btn.danger {
		height: var(--control-bar);
		padding: 0 var(--space-3);
		font-weight: 600;
		color: var(--on-accent);
		background: var(--danger);
		border-radius: var(--control-radius);
	}
	.btn.danger:disabled {
		opacity: 0.5;
	}
</style>
