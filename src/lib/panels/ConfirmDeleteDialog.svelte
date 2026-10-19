<script lang="ts">
	import { confirmDeleteDiagram } from '#lib/app/commands.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import ConfirmDialog from '#lib/ui/molecules/ConfirmDialog.svelte';

	// Deleting a diagram asks for its name first (owner's choice): the molecule wakes Delete only
	// when the typed name matches; this organism only wires it to the store. The undo toast still
	// follows, so a confirmed delete is not final either.
	const name = $derived(
		ui.confirmDelete
			? (projectStore.project.diagrams.find((d) => d.id === ui.confirmDelete?.diagramId)?.name ??
					'')
			: ''
	);
	// The molecule closes itself before it confirms, so the id is kept from when the ask opened.
	let diagramId = '';
	$effect(() => {
		if (ui.confirmDelete) diagramId = ui.confirmDelete.diagramId;
	});
</script>

<ConfirmDialog
	bind:open={() => ui.confirmDelete !== null, (open) => !open && (ui.confirmDelete = null)}
	{name}
	title={t('confirm.deleteTitle', { name })}
	description={t('confirm.deleteBody')}
	prompt={t('confirm.typeToConfirm', { name })}
	cancelLabel={t('confirm.cancel')}
	confirmLabel={t('confirm.delete')}
	onconfirm={() => confirmDeleteDiagram(diagramId)}
/>
