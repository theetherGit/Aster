<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { runCommand } from '#lib/app/commands.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { RelationshipKind } from '#lib/model/types.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';
	import Tip from '../Tip.svelte';

	// Board 03: tools by group with labels, as StarUML lists them. Element tools are the Modern
	// toolbox's; a relationship tool is the Link tool with that kind preset for the picker.
	// One toolbar (arrow keys walk every tool), three labelled groups inside it.
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
	const note = () => runCommand('create.note');
	const pick = (tool: Tool) => {
		ui.tool = ui.tool === tool ? 'select' : tool;
		if (ui.pinned !== ui.tool) ui.pinned = null;
	};
	/** StarUML's lock: a double-clicked tool keeps placing until Esc; the registry's `tool.pin`. */
	const pin = (tool: Tool) => {
		ui.tool = tool;
		if (ui.pinned !== tool) runCommand('tool.pin');
	};
	const pickRel = (kind: RelationshipKind) => {
		const same = ui.tool === 'link' && ui.lastRelationshipKind === kind;
		ui.lastRelationshipKind = kind;
		ui.tool = same ? 'select' : 'link';
	};
</script>

<section aria-labelledby="classic-toolbox-title" class="min-h-0 flex-1 overflow-auto">
	<h2 id="classic-toolbox-title" class="panel-title">{t('ui.toolbox')}</h2>
	<Toolbar.Root orientation="vertical" aria-label={t('ui.toolbox')} class="pb-2">
		<div role="group" aria-labelledby="classic-group-annotations">
			<p id="classic-group-annotations" class="group">{t('classic.group.annotations')}</p>
			<Toolbar.Button class="classic-tool" onclick={note}>
				<span class="glyph rect" aria-hidden="true"></span>{t('ui.kind.note')}
			</Toolbar.Button>
		</div>
		<div role="group" aria-labelledby="classic-group-class">
			<p id="classic-group-class" class="group">{t('classic.group.classDiagram')}</p>
			{#each ELEMENTS as e (e.tool)}
				<Tip text={e.ready ? t('ui.pinHint', { tool: e.label }) : t('ui.comingSoon')}>
					{#snippet children({ props })}
						<Toolbar.Button
							{...props}
							class="classic-tool"
							aria-pressed={ui.tool === e.tool}
							aria-label={ui.pinned === e.tool ? t('ui.toolPinned', { tool: e.label }) : undefined}
							aria-disabled={e.ready ? undefined : true}
							data-pinned={ui.pinned === e.tool || undefined}
							onclick={() => e.ready && pick(e.tool)}
							ondblclick={() => e.ready && pin(e.tool)}
						>
							<span class="glyph {e.tool}" aria-hidden="true"></span>{e.label}
							{#if !e.ready}<span class="sr-only">{t('ui.comingSoon')}</span>{/if}
						</Toolbar.Button>
					{/snippet}
				</Tip>
			{/each}
		</div>
		<div role="group" aria-labelledby="classic-group-rels">
			<p id="classic-group-rels" class="group">{t('classic.group.relationships')}</p>
			{#each RELS as kind (kind)}
				<Toolbar.Button
					class="classic-tool"
					aria-pressed={ui.tool === 'link' && ui.lastRelationshipKind === kind}
					onclick={() => pickRel(kind)}
				>
					<span class="glyph line" class:dashed={dashed(kind)} aria-hidden="true"></span>{t(
						`ui.rel.${kind}`
					)}
				</Toolbar.Button>
			{/each}
		</div>
	</Toolbar.Root>
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
	:global(.classic-tool) {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 24px;
		padding: 0 8px;
		font-size: 12.5px;
		color: var(--chrome-text);
		border-left: 2px solid transparent;
	}
	:global(.classic-tool:hover:not([aria-disabled])) {
		background: var(--chrome-surface);
	}
	:global(.classic-tool[aria-pressed='true']) {
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-bg));
		border-left-color: var(--accent);
	}
	:global(.classic-tool[data-pinned]) {
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	:global(.classic-tool[aria-disabled]) {
		color: var(--chrome-muted);
	}
	@media (forced-colors: active) {
		:global(.classic-tool[aria-pressed='true']) {
			border-left-color: Highlight;
		}
		:global(.classic-tool[data-pinned]) {
			outline: 2px solid Highlight;
			outline-offset: -2px;
		}
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
