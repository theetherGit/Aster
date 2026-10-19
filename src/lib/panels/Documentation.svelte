<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { setDocumentation } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { Id } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import { renderMarkdown } from './markdown.ts';

	// The Markdown documentation field with a preview (features.md, Properties panel).
	let { id, documentation, field }: { id: Id; documentation: string; field: string } = $props();
	let preview = $state(false);
</script>

<div class="head mt-6">
	<!-- The label only points at the textarea while it exists; the preview has no field. -->
	<SectionHeading first id="{field}-title">
		{#if preview}{t('inspector.documentation')}{:else}<label for={field}
				>{t('inspector.documentation')}</label
			>{/if}
	</SectionHeading>
	<Collapsible.Root bind:open={preview}>
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="sm" {...props}
					>{preview ? t('inspector.edit') : t('inspector.preview')}</Button
				>
			{/snippet}
		</Collapsible.Trigger>
	</Collapsible.Root>
</div>
{#if preview}
	<div
		class="markdown mt-1 min-h-20 rounded-control border border-chrome-border bg-chrome-bg px-3 py-2 text-(length:--text-body)"
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
	<Field
		multiline
		id={field}
		class="mt-1 w-full"
		placeholder={t('inspector.markdown')}
		value={documentation}
		onchange={(e: Event) => {
			const next = (e.currentTarget as HTMLTextAreaElement).value;
			if (next !== documentation) projectStore.run(setDocumentation, { id, documentation: next });
		}}
	/>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* The heading shares a row with the preview toggle: no bottom gap of its own. */
	.head > :global(.section) {
		margin: 0;
	}
	.markdown :global(p + p),
	.markdown :global(ul),
	.markdown :global(ol) {
		margin-top: var(--space-2);
	}
	.markdown :global(ul) {
		padding-inline-start: var(--space-4);
		list-style: disc;
	}
	.markdown :global(ol) {
		padding-inline-start: var(--space-4);
		list-style: decimal;
	}
	/* Markdown headings render as h3–h5 (the inspector's own are h2); sized, not nested. */
	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5) {
		margin-top: var(--space-2);
		font-weight: 600;
	}
	.markdown :global(h3) {
		font-size: var(--text-field);
	}
	.markdown :global(h4) {
		font-size: var(--text-body);
	}
	.markdown :global(h5) {
		font-size: var(--text-small);
	}
	.markdown :global(code) {
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		background: var(--chrome-surface);
		border-radius: var(--control-radius);
	}
	.markdown :global(a) {
		color: var(--accent-text);
		text-decoration: underline;
	}
</style>
