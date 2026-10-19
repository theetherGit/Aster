<script lang="ts">
	import { sieve } from '@lucasmarkes/hairline';
	import EmptyState from '#lib/ui/molecules/EmptyState.svelte';
	import { COMMANDS, type AppCommand, type Group } from '#lib/app/commands.svelte.ts';
	import { format, type Shortcut } from '#lib/app/shortcuts.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';

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
	const bare = (k: Shortcut) => !k.mod && !k.shift && !k.alt;
	function collapse(keys: Shortcut[]): Shortcut[] {
		const codes = new Set(keys.map((k) => k.code));
		const same = new Set(keys.map(mods)).size === 1;
		if (same && codes.size === 4 && ARROWS.every((c) => codes.has(c)))
			return [{ ...keys[0], code: 'Arrows' }];
		// Two bare digits are the ends of a range (the picker's 1–6): one key, not two.
		const digits = keys.map((k) => /^Digit(\d)$/.exec(k.code)?.[1]);
		if (keys.length === 2 && keys.every(bare) && digits.every(Boolean))
			return [{ code: `${digits[0]}–${digits[1]}` }];
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
	// Each column's groups with their rows, empty groups dropped, so the first heading is known.
	const columns = $derived(
		COLUMNS.map((column) =>
			column
				.map((group) => ({ group, items: merged(rows.filter((c) => c.group === group)) }))
				.filter((g) => g.items.length)
		)
	);
</script>

<DialogFrame
	title={t('sheet.title')}
	width={920}
	class="shortcuts"
	bind:open={() => ui.shortcutsOpen, (open) => !open && close()}
>
	<!-- The filter and the close sit on the title's line (the frame draws the title first). -->
	<div class="tools">
		<label for="sc-filter" class="sr-only">{t('sheet.filter')}</label>
		<Field
			id="sc-filter"
			type="search"
			class="w-44"
			placeholder={t('sheet.filterPlaceholder')}
			bind:value={filter}
		/>
		<IconButton label={t('sheet.close')} icon="x" iconSize={11} stroke={2.5} onclick={close} />
	</div>
	<p class="mt-2 flex items-center gap-2 text-(length:--text-small) text-chrome-muted">
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
	<!-- A focusable region so the list scrolls from the keyboard (axe scrollable-region-focusable);
	     columns reflow at 900 px and 200 %. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="scroller mt-3 min-h-0 flex-1 overflow-auto"
		role="region"
		aria-label={t('sheet.list')}
		tabindex="0"
	>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
			{#each columns as column, ci (ci)}
				<div>
					{#each column as { group, items }, gi (group)}
						<SectionHeading first={gi === 0}>{t(`group.${group}` as MessageKey)}</SectionHeading>
						{#each items as c (c.id)}
							<div class="flex h-7 items-center gap-2 text-(length:--text-body)">
								<span class="min-w-0 flex-1 truncate" title={c.label}>{c.label}</span>
								{#if c.staruml}<span class="star" aria-hidden="true"></span><span class="sr-only"
										>{t('sheet.starumlKey')}</span
									>{/if}
								{#each c.keys as key, i (i)}
									<Kbd>{format(key)}</Kbd>
								{/each}
							</div>
						{/each}
					{/each}
				</div>
			{/each}
		</div>
		<!-- A fade at the fold says there is more below; it sits over the scroller's bottom edge. -->
		<div class="fade" aria-hidden="true"></div>
	</div>
</DialogFrame>

<style>
	/* Layout the frame does not know: a column that caps at the viewport so the list scrolls. */
	:global(.sheet.shortcuts) {
		display: flex;
		flex-direction: column;
		max-height: 85vh;
	}
	.tools {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		align-self: flex-end;
		margin-top: calc(-1 * var(--control-icon));
	}
	.scroller {
		scrollbar-gutter: stable;
	}
	.fade {
		position: sticky;
		bottom: 0;
		height: var(--control-icon);
		margin-top: calc(-1 * var(--control-icon));
		pointer-events: none;
		background: linear-gradient(transparent, var(--chrome-surface));
	}
	.star {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--accent);
	}
</style>
