<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { tick } from 'svelte';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { connect } from '#lib/commands/index.ts';
	import { elementName } from '#lib/model/project.ts';
	import { t } from '#lib/i18n/index.ts';
	import { newId } from '#lib/model/ids.ts';
	import type { RelationshipKind } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// Order fixes the 1–6 keys (features.md, Relationship picker).
	const KINDS: RelationshipKind[] = [
		'association',
		'aggregation',
		'composition',
		'generalization',
		'realization',
		'dependency'
	];

	const anchor = $derived.by(() => {
		const p = ui.picker;
		return p ? { getBoundingClientRect: () => new DOMRect(p.x, p.y, 0, 0) } : null;
	});

	const nameOf = (id: string | undefined) => {
		const el = id ? projectStore.project.elements.get(id) : undefined;
		return el ? elementName(el) : '';
	};

	function close() {
		ui.picker = null;
		ui.link = null;
		canvasFocus.focus();
	}

	function choose(kind: RelationshipKind) {
		const p = ui.picker;
		if (!p) return;
		const id = newId();
		projectStore.run(connect, {
			diagramId: projectStore.activeDiagramId,
			id,
			sourceId: p.sourceId,
			targetId: p.targetId,
			kind
		});
		ui.lastRelationshipKind = kind;
		selection.set([id]);
		close();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const n = Number(e.key);
		if (Number.isInteger(n) && n >= 1 && n <= KINDS.length) {
			e.preventDefault();
			choose(KINDS[n - 1]);
		}
	}
</script>

<DropdownMenu.Root
	open={ui.picker !== null}
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			customAnchor={anchor}
			side="bottom"
			align="start"
			sideOffset={6}
			class="menu min-w-[220px]"
			aria-label={t('picker.title')}
			{onkeydown}
			onOpenAutoFocus={(e) => {
				// Open on the last kind chosen, so ↩ repeats it (board 05).
				e.preventDefault();
				tick().then(() =>
					document.getElementById(`aster-pick-${ui.lastRelationshipKind}`)?.focus()
				);
			}}
			onCloseAutoFocus={(e) => {
				e.preventDefault();
				canvasFocus.focus();
			}}
		>
			<DropdownMenu.Group>
				<!-- Board 05: which way the relationship goes, above the kinds. -->
				<DropdownMenu.GroupHeading
					class="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-chrome-muted uppercase"
				>
					{t('picker.heading', {
						source: nameOf(ui.picker?.sourceId),
						target: nameOf(ui.picker?.targetId)
					})}
				</DropdownMenu.GroupHeading>
				{#each KINDS as kind, i (kind)}
					<DropdownMenu.Item
						id={`aster-pick-${kind}`}
						class="menu-item gap-3"
						textValue={t(`ui.rel.${kind}`)}
						onSelect={() => choose(kind)}
					>
						<svg class="glyph" width="36" height="12" viewBox="0 0 36 12" aria-hidden="true">
							<line
								x1="1"
								y1="6"
								x2={kind === 'association' ? 35 : 22}
								y2="6"
								stroke-dasharray={kind === 'realization' || kind === 'dependency'
									? '4 3'
									: undefined}
							/>
							{#if kind === 'aggregation' || kind === 'composition'}
								<path d="M22,6 L28,2.5 L34,6 L28,9.5 Z" class:filled={kind === 'composition'} />
							{:else if kind === 'generalization' || kind === 'realization'}
								<path d="M22,1 L34,6 L22,11 Z" />
							{:else if kind === 'dependency'}
								<path d="M24,1.5 L34,6 L24,10.5" class="open" />
								<line x1="22" y1="6" x2="34" y2="6" />
							{/if}
						</svg>
						<span>{t(`ui.rel.${kind}`)}</span>
						<kbd class="ml-auto font-sans text-[11px] opacity-80">{i + 1}</kbd>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
	.glyph {
		flex-shrink: 0;
		stroke: currentColor;
		stroke-width: var(--uml-stroke);
		fill: none;
	}
	.glyph path {
		fill: var(--chrome-surface);
	}
	.glyph path.filled {
		fill: currentColor;
	}
	.glyph path.open {
		fill: none;
	}
</style>
