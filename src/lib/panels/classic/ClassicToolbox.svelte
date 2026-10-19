<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { runCommand } from '#lib/app/commands.svelte.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { RelationshipKind } from '#lib/model/types.ts';
	import { ui, type Tool } from '#lib/stores/ui.svelte.ts';
	import PanelTitle from '#lib/ui/atoms/PanelTitle.svelte';
	import Tip from '#lib/ui/atoms/Tooltip.svelte';

	// Board 03: tools by group with labels, as StarUML lists them. Element tools are the Modern
	// toolbox's; a relationship tool is the Link tool with that kind preset for the picker.
	// One toolbar (arrow keys walk every tool), three labelled groups inside it.
	// Derived, so the labels follow a locale applied after the panel mounted.
	const ELEMENTS: { tool: Tool; label: string; ready: boolean }[] = $derived([
		{ tool: 'class', label: t('ui.tool.class'), ready: true },
		{ tool: 'interface', label: t('ui.tool.interface'), ready: true },
		{ tool: 'enum', label: t('ui.tool.enum'), ready: true },
		{ tool: 'package', label: t('ui.tool.package'), ready: false }
	]);
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
	// Bits single groups: the chosen value, or '' when the chosen item is clicked again.
	const ELEMENT_TOOLS: Tool[] = ['class', 'interface', 'enum'];
	const pick = (v: string) => {
		ui.tool = v ? (v as Tool) : 'select';
		if (ui.pinned !== ui.tool) ui.pinned = null;
	};
	/** StarUML's lock: a double-clicked tool keeps placing until Esc; the registry's `tool.pin`. */
	const pin = (tool: Tool) => {
		ui.tool = tool;
		if (ui.pinned !== tool) runCommand('tool.pin');
	};
	const pickRel = (v: string) => {
		if (v) ui.lastRelationshipKind = v as RelationshipKind;
		ui.tool = v ? 'link' : 'select';
	};
</script>

<section aria-labelledby="classic-toolbox-title" class="min-h-0 flex-1 overflow-auto">
	<PanelTitle id="classic-toolbox-title">{t('ui.toolbox')}</PanelTitle>
	<Toolbar.Root orientation="vertical" aria-label={t('ui.toolbox')} class="pb-2">
		<div role="group" aria-labelledby="classic-group-annotations">
			<p id="classic-group-annotations" class="group">{t('classic.group.annotations')}</p>
			<Toolbar.Button class="classic-tool" onclick={note}>
				<span class="glyph rect" aria-hidden="true"></span>{t('ui.kind.note')}
			</Toolbar.Button>
		</div>
		<!-- Element and relationship tools are Bits single-select groups (one on at a time, the same
		     one again turns it off); Package, not built yet, stays a focusable button with its reason. -->
		<Toolbar.Group
			type="single"
			value={ELEMENT_TOOLS.includes(ui.tool) ? ui.tool : ''}
			onValueChange={pick}
			aria-labelledby="classic-group-class"
		>
			<p id="classic-group-class" class="group">{t('classic.group.classDiagram')}</p>
			{#each ELEMENTS as e (e.tool)}
				<Tip text={e.ready ? t('ui.pinHint', { tool: e.label }) : t('ui.comingSoon')}>
					{#snippet children({ props })}
						{#if e.ready}
							<Toolbar.GroupItem
								{...props}
								value={e.tool}
								class="classic-tool"
								aria-label={ui.pinned === e.tool
									? t('ui.toolPinned', { tool: e.label })
									: undefined}
								data-pinned={ui.pinned === e.tool || undefined}
								ondblclick={() => pin(e.tool)}
							>
								<span class="glyph {e.tool}" aria-hidden="true"></span>{e.label}
							</Toolbar.GroupItem>
						{:else}
							<Toolbar.Button {...props} class="classic-tool" aria-disabled="true">
								<span class="glyph {e.tool}" aria-hidden="true"></span>{e.label}
								<span class="sr-only">{t('ui.comingSoon')}</span>
							</Toolbar.Button>
						{/if}
					{/snippet}
				</Tip>
			{/each}
		</Toolbar.Group>
		<Toolbar.Group
			type="single"
			value={ui.tool === 'link' ? ui.lastRelationshipKind : ''}
			onValueChange={pickRel}
			aria-labelledby="classic-group-rels"
		>
			<p id="classic-group-rels" class="group">{t('classic.group.relationships')}</p>
			{#each RELS as kind (kind)}
				<Toolbar.GroupItem value={kind} class="classic-tool">
					<span class="glyph line" class:dashed={dashed(kind)} aria-hidden="true"></span>{t(
						`ui.rel.${kind}`
					)}
				</Toolbar.GroupItem>
			{/each}
		</Toolbar.Group>
	</Toolbar.Root>
</section>

<style>
	/* A group's caption names a toolbar group (aria-labelledby), so it is a <p>, not a heading:
	   SectionHeading's h2 and fixed margins do not fit a 24 px list. Same dress, on tokens. */
	.group {
		padding: var(--space-2) var(--space-2) var(--space-1);
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--chrome-muted);
		text-transform: uppercase;
	}
	/* Toolbar.Button and GroupItem own their elements (roving focus), so the row dress is by class. */
	:global(.classic-tool) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: var(--control-min);
		padding: 0 var(--space-2);
		font-size: var(--text-small);
		color: var(--chrome-text);
		border-inline-start: 2px solid transparent;
	}
	:global(.classic-tool:hover:not([aria-disabled])) {
		background: var(--chrome-surface);
	}
	:global(.classic-tool[data-state='on']) {
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-bg));
		border-inline-start-color: var(--accent);
	}
	:global(.classic-tool[data-pinned]) {
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	:global(.classic-tool[aria-disabled]) {
		color: var(--chrome-muted);
	}
	@media (forced-colors: active) {
		:global(.classic-tool[data-state='on']) {
			border-inline-start-color: Highlight;
		}
		:global(.classic-tool[data-pinned]) {
			outline: 2px solid Highlight;
			outline-offset: -2px;
		}
	}
	/* StarUML's tool glyphs: a 14 × 12 box in the current colour; geometry, not a token. */
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
