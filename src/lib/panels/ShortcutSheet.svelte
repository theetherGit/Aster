<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { COMMANDS, type Group } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
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
			<div class="mt-3 grid min-h-0 flex-1 grid-cols-3 gap-6 overflow-auto">
				{#each COLUMNS as column, ci (ci)}
					<div>
						{#each column as group (group)}
							{@const items = rows.filter((c) => c.group === group)}
							{#if items.length}
								<h3 class="section mt-3 first:mt-0">{t(`group.${group}` as MessageKey)}</h3>
								{#each items as c (c.id)}
									<div class="flex h-7 items-center gap-2 text-[13px]">
										<span class="min-w-0 flex-1 truncate">{c.label()}</span>
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
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
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
