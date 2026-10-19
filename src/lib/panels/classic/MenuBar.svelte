<script lang="ts">
	import { cn } from 'cn';
	import { Menubar } from 'bits-ui';
	import { MENUS, menuItems } from '#lib/app/menus.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	import { files } from '#lib/persist/files.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import MenuItem from '#lib/ui/atoms/MenuItem.svelte';
	import { menu as menuClass, menuItem } from '#lib/ui/styles.ts';

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
					<Menubar.Content class={cn(menuClass, 'min-w-60')} sideOffset={2} align="start">
						{#each menuItems(menu) as c (c.id)}
							{#if c.state}
								<!-- MenuItem has no checkbox kind: the Bits item keeps the atom's row class. -->
								<Menubar.CheckboxItem
									class={menuItem}
									checked={c.state() ?? false}
									disabled={c.when ? !c.when() : false}
									onCheckedChange={() => c.run()}
								>
									{#snippet children({ checked })}
										<span class="w-4 text-(length:--text-caption)">{checked ? '✓' : ''}</span>
										<span>{c.label()}</span>
										{#if c.keys[0]}<Kbd quiet class="ms-auto">{format(c.keys[0])}</Kbd>{/if}
									{/snippet}
								</Menubar.CheckboxItem>
							{:else}
								<MenuItem
									kind="menubar"
									disabled={c.when ? !c.when() : false}
									keys={c.keys[0] ? format(c.keys[0]) : undefined}
									onSelect={() => c.run()}
								>
									<!-- The gutter keeps plain rows in line with the checkbox rows' ticks. -->
									<span class="w-4"></span>
									<span>{c.label()}</span>
								</MenuItem>
							{/if}
						{/each}
					</Menubar.Content>
				</Menubar.Portal>
			</Menubar.Menu>
		{/each}
	</Menubar.Root>
	<span class="ms-auto truncate pe-3 text-(length:--text-small) text-chrome-muted" title={name}
		>{name}</span
	>
</div>

<style>
	.menubar-row {
		display: flex;
		align-items: center;
		height: var(--control-icon);
		padding-inline-start: var(--space-1);
		font-size: var(--text-body);
		background: var(--chrome-bg);
		border-bottom: 1px solid var(--chrome-border);
	}
	:global(.menubar) {
		display: flex;
		align-items: center;
	}
	/* Bits renders the triggers, so their dress is global, scoped by class. */
	:global(.menubar-trigger) {
		height: var(--control-min);
		padding: 0 var(--space-2);
		color: var(--chrome-text);
		border-radius: var(--control-radius);
	}
	:global(.menubar-trigger:hover),
	:global(.menubar-trigger[data-state='open']) {
		background: var(--chrome-surface);
	}
</style>
