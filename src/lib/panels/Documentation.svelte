<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { setDocumentation } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Id } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { renderMarkdown } from './markdown.ts';

	// The Markdown documentation field with a preview (features.md, Properties panel).
	let { id, documentation, field }: { id: Id; documentation: string; field: string } = $props();
	let preview = $state(false);
</script>

<div class="mt-6 flex items-center justify-between">
	<!-- The label only points at the textarea while it exists; the preview has no field. -->
	<h2 class="section mb-0" id="{field}-title">
		{#if preview}{t('inspector.documentation')}{:else}<label for={field}
				>{t('inspector.documentation')}</label
			>{/if}
	</h2>
	<Collapsible.Root bind:open={preview}>
		<Collapsible.Trigger
			class="h-7 rounded-control px-2 text-[12px] text-chrome-muted hover:text-chrome-text aria-expanded:text-chrome-text"
			>{preview ? t('inspector.edit') : t('inspector.preview')}</Collapsible.Trigger
		>
	</Collapsible.Root>
</div>
{#if preview}
	<div
		class="markdown mt-1 min-h-20 rounded-control border border-chrome-border bg-chrome-bg px-3 py-2 text-[13px]"
		data-testid="doc-preview"
		aria-labelledby="{field}-title"
	>
		{#if documentation.trim()}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes its input and emits only its own tags -->
			{@html renderMarkdown(documentation)}
		{:else}
			<p class="text-chrome-muted">{t('inspector.previewEmpty')}</p>
		{/if}
	</div>
{:else}
	<textarea
		id={field}
		class="field mt-1 h-20 w-full resize-y py-1"
		placeholder={t('inspector.markdown')}
		value={documentation}
		onchange={(e) =>
			e.currentTarget.value !== documentation &&
			projectStore.run(setDocumentation, { id, documentation: e.currentTarget.value })}></textarea>
{/if}

<style>
	.markdown :global(p + p),
	.markdown :global(ul),
	.markdown :global(ol) {
		margin-top: 6px;
	}
	.markdown :global(ul) {
		padding-left: 18px;
		list-style: disc;
	}
	.markdown :global(ol) {
		padding-left: 18px;
		list-style: decimal;
	}
	/* Markdown headings render as h3–h5 (the inspector's own are h2); sized, not nested. */
	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5) {
		margin-top: 6px;
		font-weight: 600;
	}
	.markdown :global(h3) {
		font-size: 14px;
	}
	.markdown :global(h4) {
		font-size: 13px;
	}
	.markdown :global(h5) {
		font-size: 12px;
	}
	.markdown :global(code) {
		padding: 0 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		background: var(--chrome-surface);
		border-radius: 3px;
	}
	.markdown :global(a) {
		color: var(--accent-text);
		text-decoration: underline;
	}
</style>
