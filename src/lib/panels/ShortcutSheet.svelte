<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { sieve } from '@lucasmarkes/hairline';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { COMMANDS, type AppCommand, type Group } from '#lib/app/commands.svelte.ts';
	import { format, type Shortcut } from '#lib/app/shortcuts.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Board 17: generated from the registry, three columns, StarUML's keys marked.
	const COLUMNS: Group[][] = [
		['create', 'edit'],
		['select', 'file'],
		['view', 'format', 'display']
	];
	let filter = $state('');
	const rows = $derived(
		COMMANDS.filter((c) => c.keys.length).filter((c) =>
			filter ? c.label().toLowerCase().includes(filter.toLowerCase()) : true
		)
	);
	function close() {
		ui.shortcutsOpen = false;
		filter = '';
		canvasFocus.focus();
	}

	// The registry has one command per arrow (each nudges its own way); the sheet shows them as one
	// row with the arrows as one key, and in general merges rows that share a label.
	const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
	const mods = (k: Shortcut) => `${!!k.mod}/${!!k.shift}/${!!k.alt}`;
	function collapse(keys: Shortcut[]): Shortcut[] {
		const codes = new Set(keys.map((k) => k.code));
		const same = new Set(keys.map(mods)).size === 1;
		if (same && codes.size === 4 && ARROWS.every((c) => codes.has(c)))
			return [{ ...keys[0], code: 'Arrows' }];
		return keys;
	}
	function merged(items: AppCommand[]) {
		const out: { id: string; label: string; staruml: boolean; keys: Shortcut[] }[] = [];
		for (const c of items) {
			const label = c.label();
			const row = out.find((r) => r.label === label);
			if (row) row.keys.push(...c.keys);
			else out.push({ id: c.id, label, staruml: !!c.staruml, keys: [...c.keys] });
		}
		for (const r of out) r.keys = collapse(r.keys);
		return out;
	}
</script>

<Dialog.Root
	open={ui.shortcutsOpen}
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[920px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[12px] border border-chrome-border bg-chrome-surface p-5 text-chrome-text shadow-2xl"
			aria-describedby={undefined}
		>
			<div class="flex items-center gap-3">
				<Dialog.Title class="text-[16px] font-semibold">{t('sheet.title')}</Dialog.Title>
				<span class="flex-1"></span>
				<label for="sc-filter" class="sr-only">{t('sheet.filter')}</label>
				<input
					id="sc-filter"
					type="search"
					class="field w-44"
					placeholder={t('sheet.filterPlaceholder')}
					bind:value={filter}
				/>
				<Dialog.Close class="icon-btn" aria-label={t('sheet.close')}>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
					>
				</Dialog.Close>
			</div>
			<p class="mt-2 flex items-center gap-2 text-[12px] text-chrome-muted">
				<span class="star" aria-hidden="true"></span>{t('sheet.legend')}
			</p>
			{#if rows.length === 0}
				<div class="py-8">
					<EmptyState
						figure={sieve}
						title={t('sheet.empty', { filter })}
						label={t('sheet.emptyFigure')}
						size={160}
					/>
				</div>
			{/if}
			<div class="scroller mt-3 min-h-0 flex-1 overflow-auto">
				<div class="grid grid-cols-3 gap-6">
					{#each COLUMNS as column, ci (ci)}
						<div>
							{#each column as group (group)}
								{@const items = merged(rows.filter((c) => c.group === group))}
								{#if items.length}
									<h3 class="section mt-3 first:mt-0">{t(`group.${group}` as MessageKey)}</h3>
									{#each items as c (c.id)}
										<div class="flex h-7 items-center gap-2 text-[13px]">
											<span class="min-w-0 flex-1 truncate">{c.label}</span>
											{#if c.staruml}<span class="star" aria-hidden="true"></span><span
													class="sr-only">{t('sheet.starumlKey')}</span
												>{/if}
											{#each c.keys as key, i (i)}
												<kbd>{format(key)}</kbd>
											{/each}
										</div>
									{/each}
								{/if}
							{/each}
						</div>
					{/each}
				</div>
				<!-- A fade at the fold says there is more below; it sits over the scroller's bottom edge. -->
				<div class="fade" aria-hidden="true"></div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.scroller {
		scrollbar-gutter: stable;
	}
	.fade {
		position: sticky;
		bottom: 0;
		height: 28px;
		margin-top: -28px;
		pointer-events: none;
		background: linear-gradient(transparent, var(--chrome-surface));
	}
	kbd {
		display: inline-flex;
		align-items: center;
		height: 22px;
		padding: 0 6px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 11px;
		color: var(--chrome-text);
		background: var(--chrome-bg);
		border: 1px solid var(--chrome-border);
		border-radius: 5px;
	}
	.star {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}
</style>
