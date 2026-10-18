<script lang="ts">
	import { COMMANDS } from '#lib/app/commands.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { RelationshipKind } from '#lib/model/types.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';

	// Board 03: tools by group with labels, as StarUML lists them. Element tools are the Modern
	// toolbox's; a relationship tool is the Link tool with that kind preset for the picker.
	const ELEMENTS: { tool: Tool; label: string; ready: boolean }[] = [
		{ tool: 'class', label: t('ui.tool.class'), ready: true },
		{ tool: 'interface', label: t('ui.tool.interface'), ready: true },
		{ tool: 'enum', label: t('ui.tool.enum'), ready: true },
		{ tool: 'package', label: t('ui.tool.package'), ready: false }
	];
	const RELS: RelationshipKind[] = [
		'association',
		'aggregation',
		'composition',
		'generalization',
		'realization',
		'dependency'
	];
	const dashed = (k: RelationshipKind) => k === 'realization' || k === 'dependency';
	const note = () => COMMANDS.find((c) => c.id === 'create.note')?.run();
	const pick = (tool: Tool) => {
		ui.tool = ui.tool === tool ? 'select' : tool;
		if (ui.pinned !== ui.tool) ui.pinned = null;
	};
	/** StarUML's lock: a double-clicked tool keeps placing until Esc. */
	const pin = (tool: Tool) => ((ui.tool = tool), (ui.pinned = tool));
	const pickRel = (kind: RelationshipKind) => {
		ui.lastRelationshipKind = kind;
		ui.tool = ui.tool === 'link' && ui.lastRelationshipKind === kind ? 'select' : 'link';
	};
</script>

<section aria-labelledby="classic-toolbox-title" class="min-h-0 flex-1 overflow-auto">
	<h2 id="classic-toolbox-title" class="panel-title">{t('ui.toolbox')}</h2>
	<div role="toolbar" aria-label={t('ui.toolbox')} aria-orientation="vertical" class="pb-2">
		<p class="group">{t('classic.group.annotations')}</p>
		<button type="button" class="tool" onclick={note}>
			<span class="glyph rect" aria-hidden="true"></span>{t('ui.kind.note')}
		</button>
		<p class="group">{t('classic.group.classDiagram')}</p>
		{#each ELEMENTS as e (e.tool)}
			<button
				type="button"
				class="tool"
				aria-pressed={ui.tool === e.tool}
				aria-label={ui.pinned === e.tool ? t('ui.toolPinned', { tool: e.label }) : undefined}
				data-pinned={ui.pinned === e.tool || undefined}
				disabled={!e.ready}
				title={e.ready ? t('ui.pinHint', { tool: e.label }) : t('ui.comingSoon')}
				onclick={() => pick(e.tool)}
				ondblclick={() => e.ready && pin(e.tool)}
			>
				<span class="glyph {e.tool}" aria-hidden="true"></span>{e.label}
			</button>
		{/each}
		<p class="group">{t('classic.group.relationships')}</p>
		{#each RELS as kind (kind)}
			<button
				type="button"
				class="tool"
				aria-pressed={ui.tool === 'link' && ui.lastRelationshipKind === kind}
				onclick={() => pickRel(kind)}
			>
				<span class="glyph line" class:dashed={dashed(kind)} aria-hidden="true"></span>{t(
					`ui.rel.${kind}`
				)}
			</button>
		{/each}
	</div>
</section>

<style>
	.group {
		padding: 8px 8px 4px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--chrome-muted);
		text-transform: uppercase;
	}
	.tool {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 24px;
		padding: 0 8px;
		font-size: 12.5px;
		color: var(--chrome-text);
		border-left: 3px solid transparent;
	}
	.tool:hover:not(:disabled) {
		background: var(--chrome-surface);
	}
	.tool[aria-pressed='true'] {
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-bg));
		border-left-color: var(--accent);
	}
	.tool[data-pinned] {
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.tool:disabled {
		color: var(--chrome-muted);
	}
	.glyph {
		display: inline-block;
		width: 14px;
		height: 12px;
		border: 1px solid currentColor;
		border-radius: 1px;
	}
	.glyph.class,
	.glyph.enum {
		background: linear-gradient(currentColor, currentColor) 0 4px / 100% 1px no-repeat;
	}
	.glyph.interface {
		border-radius: 7px;
	}
	.glyph.package {
		border-top-left-radius: 0;
	}
	.glyph.line {
		height: 0;
		border-width: 1px 0 0;
	}
	.glyph.line.dashed {
		border-top-style: dashed;
	}
</style>
