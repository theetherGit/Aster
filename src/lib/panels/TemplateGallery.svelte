<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { contentRects } from '#lib/export/svg.ts';
	import { t } from '#lib/i18n/index.ts';
	import { persist, thumbnailOf } from '#lib/persist/autosave.svelte.ts';
	import { openTemplate } from '#lib/persist/files.svelte.ts';
	import {
		TEMPLATE_IDS,
		loadTemplate,
		templateProject,
		type TemplateSpec
	} from '#lib/templates/index.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';

	// features.md M3, template gallery; the templates are the owner's own GitHub projects, each a
	// class diagram read off its code. A card is a picture, what the project is, what the
	// diagrams show, where it lives, and one action: it opens as a project of your own.
	interface Card {
		id: string;
		spec: TemplateSpec;
		classes: number;
		thumb?: string;
	}
	let cards = $state<Card[] | null>(null);
	let busy = $state<string | null>(null);

	$effect(() => {
		if (!ui.templatesOpen || cards) return;
		void (async () => {
			const loaded = await Promise.all(TEMPLATE_IDS.map(loadTemplate));
			cards = loaded.map(({ spec }, i) => ({
				id: TEMPLATE_IDS[i],
				spec,
				classes: new Set(spec.diagrams.flatMap((d) => d.classes.map((c) => c.id))).size
			}));
			// Pictures after the list is up: drawn with the export's renderer, one at a time.
			for (const [i, { spec, layout }] of loaded.entries()) {
				const p = templateProject(spec, layout);
				const d = p.diagrams[0];
				const thumb = await thumbnailOf(p, d.id, contentRects(p, d), 480);
				if (cards?.[i]) cards[i].thumb = thumb;
			}
		})();
	});

	async function use(id: string) {
		busy = id;
		try {
			const opened = await openTemplate(id);
			ui.templatesOpen = false;
			// From the welcome, into the editor; in the editor the address follows the project.
			if (opened && page.route.id === '/')
				await goto(resolve('/design/[slug]', { slug: persist.route ?? 'new' }));
		} finally {
			busy = null;
		}
	}
</script>

<DialogFrame
	bind:open={ui.templatesOpen}
	title={t('templates.title')}
	description={t('templates.intro')}
	width={880}
>
	{#if !cards}
		<p class="mt-4 text-(length:--text-body) text-chrome-muted" role="status">
			{t('templates.loading')}
		</p>
	{:else}
		<ul class="mt-4 grid max-h-[min(70dvh,640px)] gap-3 overflow-auto sm:grid-cols-2">
			{#each cards as c (c.id)}
				<li class="card">
					<div class="preview">
						{#if c.thumb}
							<img
								src={c.thumb}
								alt={t('templates.thumbAlt', {
									name: c.spec.name,
									diagram: c.spec.diagrams[0].name
								})}
							/>
						{/if}
					</div>
					<div class="flex flex-1 flex-col gap-1 p-3">
						<h3 class="text-(length:--text-body) font-semibold">{c.spec.name}</h3>
						<p class="text-(length:--text-small)">{c.spec.summary}</p>
						<p class="text-(length:--text-small) text-chrome-muted">{c.spec.description}</p>
						<p class="text-(length:--text-small) text-chrome-muted">
							{t(c.spec.diagrams.length === 1 ? 'templates.countOne' : 'templates.count', {
								classes: c.classes,
								diagrams: c.spec.diagrams.length
							})}
						</p>
						<div class="mt-auto flex items-center gap-3 pt-2">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- the repository on GitHub, not an app route -->
							<a
								class="link min-w-0 truncate text-(length:--text-small)"
								href={c.spec.url}
								target="_blank"
								rel="noopener noreferrer"
								>{c.spec.repo}<span class="sr-only"> {t('templates.newTab')}</span></a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<Button
								size="sm"
								class="ms-auto shrink-0"
								aria-label={t('templates.useNamed', { name: c.spec.name })}
								disabled={busy !== null}
								onclick={() => use(c.id)}
								>{busy === c.id ? t('templates.opening') : t('templates.use')}</Button
							>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet actions()}
		<Button variant="ghost" onclick={() => (ui.templatesOpen = false)}
			>{t('templates.close')}</Button
		>
	{/snippet}
</DialogFrame>

<style>
	.card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-card);
	}
	.preview {
		height: 150px;
		overflow: hidden;
		background: var(--paper-bg);
		border-bottom: 1px solid var(--chrome-border);
	}
	.preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.link {
		color: var(--accent-text);
		text-decoration: underline;
	}
</style>
