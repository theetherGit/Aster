<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { files, resolvePending } from '#lib/persist/files.svelte.ts';

	// Board 20: Bits UI AlertDialog; the three answers go through one resolver.
	const file = $derived(files.current?.name ?? '');
	const next = $derived(files.pending?.nextName ?? null);
</script>

<AlertDialog.Root
	open={files.pending !== null}
	onOpenChange={(open) => {
		if (!open) resolvePending('cancel');
	}}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-chrome-border bg-chrome-surface p-6 text-chrome-text shadow-2xl"
		>
			<AlertDialog.Title class="text-[17px] font-semibold"
				>{t('file.promptTitle', { file })}</AlertDialog.Title
			>
			<AlertDialog.Description class="mt-2 text-[14px] leading-relaxed text-chrome-muted">
				{next === null
					? t('file.promptBodyNew', { file })
					: t('file.promptBodyOpen', { file, next })}
			</AlertDialog.Description>
			<div class="mt-5 flex items-center gap-2">
				<button
					type="button"
					class="h-9 rounded-control border border-chrome-border px-3 hover:bg-chrome-bg"
					onclick={() => resolvePending('discard')}>{t('file.promptDiscard')}</button
				>
				<span class="flex-1"></span>
				<AlertDialog.Cancel
					class="h-9 rounded-control px-3 text-chrome-muted hover:text-chrome-text"
					>{t('file.promptCancel')}</AlertDialog.Cancel
				>
				<button
					type="button"
					class="h-9 rounded-control bg-accent-fill px-3 font-medium text-on-accent"
					onclick={() => resolvePending('save')}
					>{next === null ? t('file.promptSaveNew') : t('file.promptSaveOpen')}</button
				>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
