<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Board 19: one line, Undo, close; gone after a few seconds or on the next command.
	const TTL = 6000;
	$effect(() => {
		const toast = ui.toast;
		if (!toast) return;
		const id = setTimeout(() => {
			if (ui.toast === toast) ui.toast = null;
		}, TTL);
		return () => clearTimeout(id);
	});
	function undo() {
		ui.toast = null;
		projectStore.undo();
		canvasFocus.focus();
	}
</script>

{#if ui.toast}
	<div class="toast" role="status" data-testid="toast">
		<span class="min-w-0 flex-1">{ui.toast.text}</span>
		{#if ui.toast.undo}
			<button
				type="button"
				class="h-7 rounded-control border border-chrome-border px-2 font-medium hover:bg-chrome-bg"
				onclick={undo}
				>{t('ui.undo')} <kbd class="ml-1 text-[11px] text-chrome-muted">⌘Z</kbd></button
			>
		{/if}
		<button
			type="button"
			class="icon-btn h-7 w-7"
			aria-label={t('toast.dismiss')}
			onclick={() => (ui.toast = null)}>×</button
		>
	</div>
{/if}

<style>
	.toast {
		position: absolute;
		bottom: 48px;
		left: 50%;
		z-index: 30;
		display: flex;
		gap: 12px;
		align-items: center;
		max-width: min(640px, calc(100% - 48px));
		padding: 8px 10px 8px 16px;
		font-size: 13px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
		transform: translateX(-50%);
	}
</style>
