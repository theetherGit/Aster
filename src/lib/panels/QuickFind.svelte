<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { sieve } from '@lucasmarkes/hairline';
	import { jumpTo } from '#lib/canvas/actions.ts';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { t } from '#lib/i18n/index.ts';
	import { instanceLabel } from '#lib/model/project.ts';
	import type { Id } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import EmptyState from '#lib/ui/molecules/EmptyState.svelte';

	// features.md M2, quick find (⌘P, StarUML's key): elements and diagrams by name, in the
	// palette's dress (board 16). A hit opens its diagram and centres the canvas on it.
	interface Hit {
		id: Id;
		name: string;
		hint: string;
		diagram: boolean;
	}
	const hits = $derived.by((): Hit[] => {
		void ui.quickFindOpen;
		const p = projectStore.project;
		const where = (id: Id) =>
			p.diagrams.filter((d) => d.elementIds.includes(id)).map((d) => d.name);
		const out: Hit[] = p.diagrams.map((d) => ({
			id: d.id,
			name: d.name,
			hint: t('quickFind.diagram'),
			diagram: true
		}));
		for (const el of p.elements.values()) {
			let name = '';
			let kind = '';
			if (el.kind === 'classifier') [name, kind] = [el.name, t(`kind.${el.classifierKind}`)];
			else if (el.kind === 'relationship')
				[name, kind] = [el.name ?? '', t(`rel.${el.relationshipKind}`)];
			else if (el.kind === 'instance') [name, kind] = [instanceLabel(el), t('ui.kind.instance')];
			else if (el.kind === 'link') [name, kind] = [el.name ?? '', t('ui.kind.link')];
			if (!name) continue;
			const on = where(el.id);
			out.push({
				id: el.id,
				name,
				hint: on.length ? t('quickFind.on', { kind, diagrams: on.join(', ') }) : kind,
				diagram: false
			});
		}
		return out;
	});
	let search = $state('');
	/** Names only (ids and hints never match); every typed word must appear. */
	const filter = (_value: string, query: string, keywords?: string[]) => {
		const hay = (keywords?.[0] ?? '').toLowerCase();
		return query
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((w) => hay.includes(w))
			? 1
			: 0;
	};
	function close() {
		ui.quickFindOpen = false;
		search = '';
	}
	function open(hit: Hit) {
		close();
		requestAnimationFrame(() => {
			if (hit.diagram) {
				projectStore.activeDiagramId = hit.id;
				canvasFocus.focus();
				return;
			}
			jumpTo(hit.id);
			canvasApi.centreOn(hit.id);
		});
	}
</script>

<Dialog.Root
	open={ui.quickFindOpen}
	onOpenChange={(o) => {
		if (!o) close();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-(--z-dialog) bg-black/45" />
		<Dialog.Content
			class="fixed top-[12vh] left-1/2 z-(--z-dialog) w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-card border border-chrome-border bg-chrome-surface text-chrome-text shadow-dialog"
			aria-label={t('quickFind.title')}
			aria-describedby={undefined}
			onCloseAutoFocus={(e) => {
				e.preventDefault();
				canvasFocus.focus();
			}}
		>
			<Dialog.Title class="sr-only">{t('quickFind.title')}</Dialog.Title>
			<Command.Root class="flex flex-col" loop {filter}>
				<div class="flex items-center gap-2 border-b border-chrome-border px-3">
					<Icon name="search" size={16} class="text-chrome-muted" />
					<Command.Input
						bind:value={search}
						class="h-11 min-w-0 flex-1 bg-transparent text-(length:--text-field) placeholder:text-chrome-muted"
						placeholder={t('quickFind.placeholder')}
						aria-label={t('quickFind.search')}
					/>
				</div>
				<Command.List
					class="max-h-[50vh] overflow-auto p-1"
					aria-label={t('quickFind.list')}
					tabindex={0}
				>
					<Command.Viewport>
						<Command.Empty class="px-3 py-5">
							<EmptyState
								figure={sieve}
								title={t('quickFind.empty')}
								label={t('quickFind.emptyFigure')}
								size={160}
							/>
						</Command.Empty>
						{#each hits as hit (hit.id)}
							<Command.Item
								value={hit.id}
								keywords={[hit.name]}
								onSelect={() => open(hit)}
								class="flex h-8 items-center gap-3 rounded-control px-2 text-(length:--text-body) data-selected:bg-(--selection-tint)"
							>
								<span class="min-w-0 flex-1 truncate">{hit.name}</span>
								<span class="shrink-0 text-(length:--text-small) text-chrome-muted">{hit.hint}</span
								>
							</Command.Item>
						{/each}
					</Command.Viewport>
				</Command.List>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
