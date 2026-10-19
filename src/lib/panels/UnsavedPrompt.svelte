<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { files, resolvePending } from '#lib/persist/files.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';

	// Board 20: an alert dialog; the three answers go through one resolver. Closing it any other
	// way (Esc, the overlay) is a cancel.
	const file = $derived(files.current?.name ?? '');
	const next = $derived(files.pending?.nextName ?? null);
</script>

<DialogFrame
	alert
	width={560}
	title={t('file.promptTitle', { file })}
	description={next === null
		? t('file.promptBodyNew', { file })
		: t('file.promptBodyOpen', { file, next })}
	bind:open={() => files.pending !== null, (open) => !open && resolvePending('cancel')}
>
	{#snippet actions()}
		<Button class="me-auto" onclick={() => resolvePending('discard')}
			>{t('file.promptDiscard')}</Button
		>
		<Button variant="ghost" onclick={() => resolvePending('cancel')}
			>{t('file.promptCancel')}</Button
		>
		<Button variant="primary" onclick={() => resolvePending('save')}
			>{next === null ? t('file.promptSaveNew') : t('file.promptSaveOpen')}</Button
		>
	{/snippet}
</DialogFrame>
