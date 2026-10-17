<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { t } from '#lib/i18n/index.ts';
	import { files, openFromPicker, openRecent } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
</script>

<!-- Project name as the menu for Open and Recent (Modern has no menu bar). -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="flex h-8 min-w-0 items-center gap-1 rounded-control px-2 font-semibold hover:bg-chrome-surface"
		title={t('file.menu')}
	>
		<span class="truncate" data-testid="project-name">{projectStore.project.name}</span>
		<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor"
			><path d="M1 3l4 4 4-4z" /></svg
		>
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="menu min-w-[240px]" sideOffset={4} align="start">
			<DropdownMenu.Item class="menu-item" onSelect={() => openFromPicker()}>
				<span>{t('file.open')}</span>
				<kbd class="ml-auto font-sans text-[11px] opacity-80">{t('file.openShortcut')}</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="my-1 h-px bg-chrome-border" />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading
					class="px-2 py-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
					>{t('file.recent')}</DropdownMenu.GroupHeading
				>
				{#each files.recent as r (r.name)}
					<DropdownMenu.Item class="menu-item" onSelect={() => openRecent(r.name)}
						>{r.name}</DropdownMenu.Item
					>
				{:else}
					<DropdownMenu.Item class="menu-item" disabled>{t('file.recentEmpty')}</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
