<script lang="ts">
	import { cn } from 'cn';
	import { DropdownMenu } from 'bits-ui';
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { renameProject } from '#lib/commands/index.ts';
	import InlineName from '#lib/ui/molecules/InlineName.svelte';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { currentKey, openSaved, persist } from '#lib/persist/autosave.svelte.ts';
	import { files, guardUnsaved } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Tip from '#lib/ui/atoms/Tooltip.svelte';
	import { ago } from './time.ts';
	import Icon, { type IconName } from '#lib/ui/atoms/Icon.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import MenuItem from '#lib/ui/atoms/MenuItem.svelte';
	import Separator from '#lib/ui/atoms/Separator.svelte';
	import { menu, menuItem } from '#lib/ui/styles.ts';

	// The rows are registry commands (label, key, run), so the menu never retypes a shortcut.
	const ROWS = [
		'file.new',
		'file.open',
		'file.save',
		'file.saveAs',
		'file.importPuml',
		'file.importFragment',
		'file.exportPuml'
	].flatMap((id) => {
		const c = byId(id);
		return c ? [c] : [];
	});
	const outline = byId('view.outline');
	const ICONS: Record<string, IconName> = {
		'file.new': 'file-plus',
		'file.open': 'folder-open',
		'file.save': 'save',
		'file.saveAs': 'save-all',
		'file.importPuml': 'folder-open',
		'file.importFragment': 'folder-open',
		'file.exportPuml': 'save'
	};
	async function renamed() {
		ui.renaming = null;
		await tick();
		document.querySelector<HTMLElement>('[data-testid="project-menu"]')?.focus();
	}
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : '';
	};
	// "Saved … 3 min ago" has to move; a 30 s tick keeps it honest while the bar is up.
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	// ui.md save states: no dot when saved, accent when unsaved to a file, amber when never saved.
	const stateTitle = $derived(
		files.state === 'saved'
			? files.lastSavedAt
				? t('file.stateSaved', {
						file: files.current?.name ?? '',
						ago: ago(files.lastSavedAt, now)
					})
				: t('file.stateSavedNoTime', { file: files.current?.name ?? '' })
			: files.state === 'unsaved'
				? t('file.stateUnsaved', { file: files.current?.name ?? '' })
				: t('file.stateNever')
	);
	const openEntry = (id: string, name: string) =>
		guardUnsaved(name, async () => {
			await openSaved(id);
			ui.sampleStrip = false;
		});
</script>

<!-- Project name as the menu for New, Open, Save and Recent (Modern has no menu bar). -->
{#if ui.renaming === 'project'}
	<InlineName
		value={projectStore.project.name}
		label={t('ui.projectName')}
		class="h-8 w-56 text-(length:--text-lead) font-semibold"
		oncommit={(name) => projectStore.run(renameProject, { name })}
		ondone={renamed}
	/>
{:else}
	<DropdownMenu.Root>
		<Tip text={stateTitle}>
			{#snippet children({ props })}
				<DropdownMenu.Trigger
					{...props}
					data-testid="project-menu"
					class="group flex h-8 min-w-0 items-center gap-1.5 rounded-control px-2 font-semibold hover:bg-chrome-surface"
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'F2') {
							e.preventDefault();
							runCommand('project.rename');
						}
					}}
				>
					<span class="truncate" data-testid="project-name" title={projectStore.project.name}
						>{projectStore.project.name}</span
					>
					{#if files.state === 'unsaved' || files.state === 'never'}
						<span
							class="dot"
							class:never={files.state === 'never'}
							data-testid="save-state"
							data-state={files.state}
							role="img"
							aria-label={stateTitle}
						></span>
					{/if}
					<Icon
						name="chevron-down"
						size={12}
						class="text-chrome-muted group-hover:text-chrome-text group-data-[state=open]:text-chrome-text"
					/>
				</DropdownMenu.Trigger>
			{/snippet}
		</Tip>
		<DropdownMenu.Portal>
			<DropdownMenu.Content class={cn(menu, 'min-w-65')} sideOffset={4} align="start">
				<MenuItem
					icon="pencil"
					label={t('ui.renameProject')}
					onSelect={() => runCommand('project.rename')}
				/>
				<Separator class="my-1" />
				{#each ROWS as c (c.id)}
					<MenuItem
						icon={ICONS[c.id] ?? 'file-plus'}
						label={c.label()}
						keys={key(c.id)}
						onSelect={() => runCommand(c.id)}
					/>
				{/each}
				{#if outline}
					<!-- A checkbox row: the MenuItem atom has no checked state, so the Bits item keeps its dress class. -->
					<DropdownMenu.CheckboxItem
						class={menuItem}
						checked={ui.panels.outline}
						onCheckedChange={() => outline.run()}
					>
						{#snippet children({ checked })}
							<Icon name="panel-left" class={checked ? 'text-accent-text' : 'text-chrome-muted'} />
							<span>{outline.label()}</span>
							<Kbd quiet class="ms-auto">{key(outline.id)}</Kbd>
						{/snippet}
					</DropdownMenu.CheckboxItem>
				{/if}
				<Separator class="my-1" />
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading
						class="px-2 py-1 text-(length:--text-caption) font-semibold tracking-wide text-chrome-muted uppercase"
						>{t('file.recent')}</DropdownMenu.GroupHeading
					>
					{#each persist.recent.filter((r) => r.id !== currentKey()) as r (r.id)}
						<MenuItem onSelect={() => openEntry(r.id, r.fileName ?? r.name)}>
							<span class="truncate" title={r.fileName ?? r.name}>{r.fileName ?? r.name}</span>
						</MenuItem>
					{:else}
						<MenuItem label={t('file.recentEmpty')} disabled />
					{/each}
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{/if}

<style>
	.dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--accent);
	}
	.dot.never {
		background: var(--warning);
	}
</style>
