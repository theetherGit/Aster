<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { pwa } from '#lib/stores/pwa.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';

	// Features.md M3, PWA: "update prompt". Shown on every page once a new version has installed;
	// it stays until answered, since a reload is the reader's call, never the app's.
	$effect(() => {
		pwa.start();
	});
</script>

{#if pwa.updateReady}
	<div class="update" role="status" data-testid="update-prompt">
		<span class="min-w-0 flex-1">{t('pwa.updateReady')}</span>
		<Button variant="primary" size="sm" onclick={() => pwa.apply()}>{t('pwa.reload')}</Button>
		<Button variant="ghost" size="sm" onclick={() => pwa.dismiss()}>{t('pwa.later')}</Button>
	</div>
{/if}

<style>
	/* The toast's sibling (Toast.svelte): bottom left, so the two never cover each other. */
	.update {
		position: fixed;
		bottom: var(--space-6);
		left: var(--space-6);
		z-index: var(--z-notice);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		align-items: center;
		max-width: min(480px, calc(100vw - var(--space-12)));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		font-size: var(--text-body);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-menu);
		box-shadow: var(--shadow-toast);
	}
</style>
