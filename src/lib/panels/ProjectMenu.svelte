<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { currentKey, openSaved, persist } from '#lib/persist/autosave.svelte.ts';
	import {
		files,
		guardUnsaved,
		newProject,
		openFromPicker,
		saveFile
	} from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// ui.md save states: no dot when saved, accent when unsaved to a file, amber when never saved.
	const stateTitle = $derived(
		files.state === 'saved'
			? t('file.stateSavedNoTime', { file: files.current?.name ?? '' })
			: files.state === 'unsaved'
				? t('file.stateUnsaved', { file: files.current?.name ?? '' })
				: t('file.stateNever')
	);
	const openEntry = (id: string, name: string) =>
		guardUnsaved(name, async () => {
			await openSaved(id);
			ui.welcome = false;
			ui.sampleStrip = false;
		});
</script>

<!-- Project name as the menu for New, Open, Save and Recent (Modern has no menu bar). -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="group flex h-8 min-w-0 items-center gap-1.5 rounded-control px-2 font-semibold hover:bg-chrome-surface"
		title={stateTitle}
	>
		<span class="truncate" data-testid="project-name">{projectStore.project.name}</span>
		{#if files.state !== 'saved'}
			<span
				class="dot"
				class:never={files.state === 'never'}
				data-testid="save-state"
				data-state={files.state}
				role="img"
				aria-label={stateTitle}
			></span>
		{/if}
		<svg
			class="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100"
			width="10"
			height="10"
			viewBox="0 0 10 10"
			aria-hidden="true"
			fill="currentColor"><path d="M1 3l4 4 4-4z" /></svg
		>
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="menu min-w-[260px]" sideOffset={4} align="start">
			<DropdownMenu.Item class="menu-item" onSelect={() => newProject()}>
				<span>{t('file.new')}</span>
				<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('file.newShortcut')}</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.Item class="menu-item" onSelect={() => openFromPicker()}>
				<span>{t('file.open')}</span>
				<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('file.openShortcut')}</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.Item class="menu-item" onSelect={() => saveFile()}>
				<span>{t('file.save')}</span>
				<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('file.saveShortcut')}</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.Item class="menu-item" onSelect={() => saveFile(true)}>
				<span>{t('file.saveAs')}</span>
				<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('file.saveAsShortcut')}</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.CheckboxItem
				class="menu-item"
				checked={ui.panels.outline}
				onCheckedChange={(v) => (ui.panels.outline = v)}
			>
				{#snippet children({ checked })}
					<span class="w-4 text-[11px]">{checked ? '✓' : ''}</span>
					<span>{t('explorer.title')}</span>
					<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('explorer.shortcut')}</kbd>
				{/snippet}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Separator class="my-1 h-px bg-chrome-border" />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading
					class="px-2 py-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
					>{t('file.recent')}</DropdownMenu.GroupHeading
				>
				{#each persist.recent.filter((r) => r.id !== currentKey()) as r (r.id)}
					<DropdownMenu.Item
						class="menu-item"
						onSelect={() => openEntry(r.id, r.fileName ?? r.name)}
					>
						<span class="truncate">{r.fileName ?? r.name}</span>
					</DropdownMenu.Item>
				{:else}
					<DropdownMenu.Item class="menu-item" disabled>{t('file.recentEmpty')}</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
	}
	.dot.never {
		background: var(--warning);
	}
</style>
