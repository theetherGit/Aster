<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { sieve } from '@lucasmarkes/hairline';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { COMMANDS, type AppCommand, type Group } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Board 16: Bits UI Command in a Dialog. The list is the registry, filtered by Bits.
	const GROUPS: Group[] = ['display', 'create', 'edit', 'select', 'view', 'format', 'file'];
	let search = $state('');
	// Read once per open: `when` and `state` depend on the selection at that moment.
	const available = $derived.by(() => {
		void ui.paletteOpen;
		void projectStore.version;
		return COMMANDS.filter((c) => !c.sheetOnly && (!c.when || c.when()));
	});
	const actsOn = $derived.by(() => {
		if (selection.size === 1) {
			const el = projectStore.project.elements.get(selection.list[0]);
			return el ? t('palette.actsOn', { name: elementName(el) }) : null;
		}
		if (selection.size > 1) return t('palette.actsOnMany', { count: selection.size });
		return t('palette.actsOnDiagram');
	});
	// Focus returns to where it was: the canvas unless a field had it.
	let restore: HTMLElement | null = null;
	function close() {
		ui.paletteOpen = false;
		search = '';
		if (restore && document.contains(restore)) restore.focus();
		else canvasFocus.focus();
	}
	function run(c: AppCommand) {
		close();
		// After the dialog has given focus back, so the command acts on the right context.
		requestAnimationFrame(() => c.run());
	}
	$effect(() => {
		if (ui.paletteOpen) restore = document.activeElement as HTMLElement | null;
	});
	let matches = $state(0);
	/** Every typed word must appear in the label (or a keyword); no fuzzy surprises. */
	const wordFilter = (value: string, search: string, keywords?: string[]) => {
		const hay = `${value} ${keywords?.join(' ') ?? ''}`.toLowerCase();
		const words = search.toLowerCase().split(/\s+/).filter(Boolean);
		return words.every((w) => hay.includes(w)) ? 1 : 0;
	};
	const stateText = (c: AppCommand) => {
		const s = c.state?.();
		return s === undefined || s === null ? '' : s ? t('palette.on') : t('palette.off');
	};
</script>

<Dialog.Root
	open={ui.paletteOpen}
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
		<Dialog.Content
			class="fixed top-[12vh] left-1/2 z-50 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[12px] border border-chrome-border bg-chrome-surface text-chrome-text shadow-2xl"
			aria-label={t('ui.palette')}
			aria-describedby={undefined}
		>
			<Dialog.Title class="sr-only">{t('ui.palette')}</Dialog.Title>
			<Command.Root
				class="flex flex-col"
				loop
				filter={wordFilter}
				onStateChange={(s) => (matches = s.filtered.count)}
			>
				<div class="flex items-center gap-2 border-b border-chrome-border px-3">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
					>
					<Command.Input
						bind:value={search}
						class="h-11 min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-chrome-muted"
						placeholder={t('palette.placeholder')}
						aria-label={t('palette.search')}
					/>
					{#if actsOn}<span class="shrink-0 text-[12px] text-chrome-muted">{actsOn}</span>{/if}
				</div>
				<!-- Focusable so the scrolling list is keyboard-scrollable; arrows still walk the rows. -->
				<Command.List
					class="max-h-[50vh] overflow-auto p-1"
					aria-label={t('palette.list')}
					tabindex={0}
				>
					<Command.Viewport>
						<Command.Empty class="px-3 py-5">
							<EmptyState
								figure={sieve}
								title={t('palette.empty')}
								label={t('palette.emptyFigure')}
								size={160}
							/>
						</Command.Empty>
						{#each GROUPS as group (group)}
							{@const items = available.filter((c) => c.group === group)}
							{#if items.length}
								<Command.Group value={group}>
									<Command.GroupHeading
										class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
										>{t(`group.${group}` as MessageKey)}</Command.GroupHeading
									>
									<Command.GroupItems>
										{#each items as c (c.id)}
											<Command.Item
												value={c.label()}
												keywords={[c.id, group]}
												onSelect={() => run(c)}
												class="flex h-8 items-center gap-3 rounded-[6px] px-2 text-[13px] data-selected:bg-(--selection-tint)"
											>
												<span class="min-w-0 flex-1 truncate">{c.label()}</span>
												{#if stateText(c)}<span class="text-[12px] text-chrome-muted"
														>{stateText(c)}</span
													>{/if}
												{#if c.keys[0]}<kbd class="font-sans text-[11px] text-chrome-muted"
														>{format(c.keys[0])}</kbd
													>{/if}
											</Command.Item>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
						{/each}
					</Command.Viewport>
				</Command.List>
				<div
					class="flex items-center justify-between border-t border-chrome-border px-3 py-1.5 text-[11px] text-chrome-muted"
				>
					<span>{t('palette.hints')}</span>
					<span>{t('palette.matches', { count: matches })}</span>
				</div>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
