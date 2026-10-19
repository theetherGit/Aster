<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import { confirmDeleteDiagram } from '#lib/app/commands.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Deleting a diagram asks for its name first (owner's choice, after the pattern of the
	// shadcn-svelte-extras confirm-delete dialog, built on Bits UI AlertDialog): the Delete button
	// wakes only when the typed name matches, Cancel and Esc leave everything as it was. The undo
	// toast still follows, so a confirmed delete is not final either.
	const name = $derived(
		ui.confirmDelete
			? (projectStore.project.diagrams.find((d) => d.id === ui.confirmDelete?.diagramId)?.name ??
					'')
			: ''
	);
	let typed = $state('');
	const matches = $derived(typed.trim() === name);
	function close() {
		ui.confirmDelete = null;
		typed = '';
	}
	function confirm() {
		if (!matches || !ui.confirmDelete) return;
		const id = ui.confirmDelete.diagramId;
		close();
		confirmDeleteDiagram(id);
	}
</script>

<AlertDialog.Root
	open={ui.confirmDelete !== null}
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[460px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-chrome-border bg-chrome-surface p-6 text-chrome-text shadow-2xl"
			onOpenAutoFocus={(e) => {
				// The name field takes focus once mounted; Bits' own first-tabbable pass can run early.
				e.preventDefault();
				requestAnimationFrame(() =>
					requestAnimationFrame(() => document.getElementById('confirm-delete-name')?.focus())
				);
			}}
		>
			<AlertDialog.Title class="text-[17px] font-semibold"
				>{t('confirm.deleteTitle', { name })}</AlertDialog.Title
			>
			<AlertDialog.Description class="mt-2 text-[14px] leading-relaxed text-chrome-muted">
				{t('confirm.deleteBody')}
			</AlertDialog.Description>
			<form
				class="mt-4"
				onsubmit={(e) => {
					e.preventDefault();
					confirm();
				}}
			>
				<label for="confirm-delete-name" class="mb-1 block text-[13px] text-chrome-muted"
					>{t('confirm.typeToConfirm', { name })}</label
				>
				<input
					id="confirm-delete-name"
					class="field h-9 w-full text-[14px]"
					type="text"
					autocomplete="off"
					spellcheck="false"
					bind:value={typed}
				/>
				<div class="mt-5 flex items-center justify-end gap-2">
					<!-- type=button: inside the form, Enter must reach Delete, not the first button in tree order. -->
					<AlertDialog.Cancel
						type="button"
						class="h-9 rounded-control px-3 text-chrome-muted hover:text-chrome-text"
						>{t('confirm.cancel')}</AlertDialog.Cancel
					>
					<button
						type="submit"
						class="h-9 rounded-control bg-danger px-3 font-medium text-on-accent disabled:opacity-50"
						disabled={!matches}
						data-testid="confirm-delete">{t('confirm.delete')}</button
					>
				</div>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
