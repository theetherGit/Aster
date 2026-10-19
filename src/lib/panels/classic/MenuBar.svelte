<script lang="ts">
	import { Menubar } from 'bits-ui';
	import { MENUS, menuItems } from '#lib/app/menus.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { files } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// Board 03: a 28 px menu bar generated from the command registry; the file name at the far end.
	// Labels and `when` are read when a menu opens, so a toggle's state is always current.
	const name = $derived(files.current?.name ?? projectStore.project.name);
</script>

<!-- The file name sits beside the menubar, not inside it: a menubar's children are menu items. -->
<div class="menubar-row">
	<Menubar.Root class="menubar" aria-label={t('classic.menubar')}>
		{#each MENUS as menu (menu.id)}
			<Menubar.Menu>
				<Menubar.Trigger class="menubar-trigger">{t(menu.label)}</Menubar.Trigger>
				<Menubar.Portal>
					<Menubar.Content class="menu min-w-[240px]" sideOffset={2} align="start">
						{#each menuItems(menu) as c (c.id)}
							{#if c.state}
								<Menubar.CheckboxItem
									class="menu-item"
									checked={c.state() ?? false}
									disabled={c.when ? !c.when() : false}
									onCheckedChange={() => c.run()}
								>
									{#snippet children({ checked })}
										<span class="w-4 text-[11px]">{checked ? '✓' : ''}</span>
										<span>{c.label()}</span>
										{#if c.keys[0]}<kbd class="key">{format(c.keys[0])}</kbd>{/if}
									{/snippet}
								</Menubar.CheckboxItem>
							{:else}
								<Menubar.Item
									class="menu-item"
									disabled={c.when ? !c.when() : false}
									onSelect={() => c.run()}
								>
									<span class="w-4"></span>
									<span>{c.label()}</span>
									{#if c.keys[0]}<kbd class="key">{format(c.keys[0])}</kbd>{/if}
								</Menubar.Item>
							{/if}
						{/each}
					</Menubar.Content>
				</Menubar.Portal>
			</Menubar.Menu>
		{/each}
	</Menubar.Root>
	<span class="ml-auto truncate pr-3 text-[12px] text-chrome-muted" title={name}>{name}</span>
</div>

<style>
	.menubar-row {
		display: flex;
		align-items: center;
		height: 28px;
		padding-left: 4px;
		font-size: 13px;
		background: var(--chrome-bg);
		border-bottom: 1px solid var(--chrome-border);
	}
	:global(.menubar) {
		display: flex;
		align-items: center;
	}
	:global(.menubar-trigger) {
		height: 24px;
		padding: 0 10px;
		color: var(--chrome-text);
		border-radius: 3px;
	}
	:global(.menubar-trigger:hover),
	:global(.menubar-trigger[data-state='open']) {
		background: var(--chrome-surface);
	}
	.key {
		margin-left: auto;
		font-family: var(--font-sans);
		font-size: 11px;
		opacity: 0.8;
	}
</style>
