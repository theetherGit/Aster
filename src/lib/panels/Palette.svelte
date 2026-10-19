<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { sieve } from '@lucasmarkes/hairline';
	import EmptyState from '#lib/ui/molecules/EmptyState.svelte';
	import { COMMANDS, type AppCommand, type Group } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';

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
		<!-- Not DialogFrame: that sheet draws a visible title and pads a centred body; the palette is
		     an unpadded strip near the top with a hidden name, so it wears the frame's .dim/.sheet
		     classes and overrides only its place. -->
		<Dialog.Overlay class="dim" />
		<Dialog.Content class="sheet palette" aria-label={t('ui.palette')} aria-describedby={undefined}>
			<Dialog.Title class="sr-only">{t('ui.palette')}</Dialog.Title>
			<Command.Root
				class="flex flex-col"
				loop
				filter={wordFilter}
				onStateChange={(s) => (matches = s.filtered.count)}
			>
				<div class="flex items-center gap-2 border-b border-chrome-border px-3">
					<Icon name="search" size={16} class="text-chrome-muted" />
					<Command.Input
						bind:value={search}
						class="h-11 min-w-0 flex-1 bg-transparent text-(length:--text-field) placeholder:text-chrome-muted"
						placeholder={t('palette.placeholder')}
						aria-label={t('palette.search')}
					/>
					{#if actsOn}<span class="shrink-0 text-(length:--text-small) text-chrome-muted"
							>{actsOn}</span
						>{/if}
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
										class="px-2 pt-2 pb-1 text-(length:--text-caption) font-semibold tracking-wide text-chrome-muted uppercase"
										>{t(`group.${group}` as MessageKey)}</Command.GroupHeading
									>
									<Command.GroupItems>
										{#each items as c (c.id)}
											<Command.Item
												value={c.label()}
												keywords={[c.id, group]}
												onSelect={() => run(c)}
												class="flex h-8 items-center gap-3 rounded-control px-2 text-(length:--text-body) data-selected:bg-(--selection-tint)"
											>
												<span class="min-w-0 flex-1 truncate">{c.label()}</span>
												{#if stateText(c)}<span class="text-(length:--text-small) text-chrome-muted"
														>{stateText(c)}</span
													>{/if}
												{#if c.keys[0]}<Kbd quiet>{format(c.keys[0])}</Kbd>{/if}
											</Command.Item>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
						{/each}
					</Command.Viewport>
				</Command.List>
				<div
					class="flex items-center justify-between border-t border-chrome-border px-3 py-1.5 text-(length:--text-caption) text-chrome-muted"
				>
					<span>{t('palette.hints')}</span>
					<span>{t('palette.matches', { count: matches })}</span>
				</div>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Where the palette sits: near the top, unpadded, its list clipped to the sheet's corners. */
	:global(.sheet.palette) {
		top: 12vh;
		width: 560px;
		padding: 0;
		overflow: hidden;
		transform: translateX(-50%);
	}
</style>
