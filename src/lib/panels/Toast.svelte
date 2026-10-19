<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';

	// Board 19: one line, Undo, close; gone after a few seconds or on the next command. The timer
	// pauses while the pointer or focus is on it (WCAG 2.2.1), and a toast that goes while it holds
	// focus hands focus back to the canvas.
	const TTL = 6000;
	let held = $state(false);
	let el = $state<HTMLElement>();
	$effect(() => {
		const toast = ui.toast;
		if (!toast || held) return;
		const id = setTimeout(() => {
			if (ui.toast === toast) dismiss();
		}, TTL);
		return () => clearTimeout(id);
	});
	function dismiss() {
		if (el?.contains(document.activeElement)) canvasFocus.focus();
		ui.toast = null;
	}
	function undo() {
		dismiss();
		projectStore.undo();
		canvasFocus.focus();
	}
	const undoKey = format(byId('edit.undo')!.keys[0]);
</script>

{#if ui.toast}
	<div
		class="toast"
		role="status"
		data-testid="toast"
		bind:this={el}
		onpointerenter={() => (held = true)}
		onpointerleave={() => (held = false)}
		onfocusin={() => (held = true)}
		onfocusout={(e) => (held = el?.contains(e.relatedTarget as Node) ?? false)}
	>
		<span class="min-w-0 flex-1">{ui.toast.text}</span>
		{#if ui.toast.undo}
			<Button variant="secondary" size="sm" onclick={undo}
				>{t('ui.undo')} <Kbd quiet>{undoKey}</Kbd></Button
			>
		{/if}
		<IconButton
			label={t('toast.dismiss')}
			icon="x"
			iconSize={12}
			stroke={2.5}
			tip={false}
			onclick={dismiss}
		/>
	</div>
{/if}

<style>
	.toast {
		position: absolute;
		bottom: var(--space-12);
		left: 50%;
		z-index: var(--z-toast);
		display: flex;
		gap: var(--space-3);
		align-items: center;
		max-width: min(640px, calc(100% - var(--space-12)));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		font-size: var(--text-body);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-menu);
		box-shadow: var(--shadow-toast);
		transform: translateX(-50%);
	}
</style>
