<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { hairline } from '#lib/actions/hairline.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { contentRects } from '#lib/export/svg.ts';
	import { aster } from '#lib/figures/aster.ts';
	import { t } from '#lib/i18n/index.ts';
	import { sampleProject } from '#lib/model/fixtures.ts';
	import {
		clearRecent,
		loadRecent,
		openSaved,
		persist,
		thumbnailOf
	} from '#lib/persist/autosave.svelte.ts';
	import { files, loadFixture, openFromPicker } from '#lib/persist/files.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { ago } from './time.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';

	// Boards 07 (first visit) and 23 (returning): two columns, the mark and the two actions on the
	// left, the sample card and Recent on the right. Every action ends in `/design/<route>`.
	const design = () => goto(resolve('/design/[slug]', { slug: persist.route ?? 'new' }));
	function explore() {
		loadFixture(sampleProject(), 'sample');
		ui.sampleStrip = true;
		return design();
	}
	async function open() {
		await openFromPicker();
		if (files.current) await design();
	}
	async function recent(id: string) {
		if (await openSaved(id)) await design();
	}

	// The sample card's picture: the bundled sample through the Recent list's renderer, with node
	// sizes from the same metrics the canvas uses, since no canvas is on this page.
	let sampleThumb = $state<string>();
	// The Button atom takes no ref; the first action is found under the section when it mounts.
	let section: HTMLElement;
	// Keys from the registry, formatted for the platform (⌘ on macOS, Ctrl elsewhere).
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : '';
	};
	// "3 min ago" in Recent has to move; a 30 s tick keeps it honest while the page is up.
	let now = $state(Date.now());
	onMount(() => {
		section.querySelector<HTMLElement>('.action.primary')?.focus();
		loadRecent();
		const timer = setInterval(() => (now = Date.now()), 30_000);
		const sample = sampleProject();
		const diagram = sample.diagrams[0];
		thumbnailOf(sample, diagram.id, contentRects(sample, diagram), 560).then(
			(png) => (sampleThumb = png)
		);
		return () => clearInterval(timer);
	});

	// `.mdj` and `.aster` in the tagline are set in monospace, as on the board.
	const tagline = $derived(t('welcome.tagline').split(/(\.mdj|\.aster)/));
</script>

<section class="welcome" aria-labelledby="welcome-title" bind:this={section}>
	<div class="columns">
		<div class="left">
			<div
				class="figure"
				use:hairline={{ figure: aster, label: t('welcome.figure'), intensity: 0.4, play: false }}
			></div>
			<h1
				id="welcome-title"
				class="mt-2 text-(length:--text-display) leading-tight font-semibold tracking-tight"
			>
				{t('welcome.title')}
			</h1>
			<p class="mt-2 max-w-[400px] text-(length:--text-field) leading-normal text-chrome-muted">
				{#each tagline as part, i (i)}
					{#if part === '.mdj' || part === '.aster'}<code>{part}</code>{:else}{part}{/if}
				{/each}
			</p>
			<div class="actions">
				<Button
					variant="primary"
					class="action primary"
					onclick={() => goto(resolve('/design/[slug]', { slug: 'new' }))}
				>
					<span>{t('welcome.new')}</span>
					<Kbd quiet>{key('file.new')}</Kbd>
				</Button>
				<Button class="action" onclick={open}>
					<span class="inline-flex items-baseline gap-1.5">
						<span>{t('welcome.open')}</span>
						<span class="text-(length:--text-small) text-chrome-muted"
							>{t('welcome.openFormats')}</span
						>
					</span>
					<Kbd quiet>{key('file.open')}</Kbd>
				</Button>
			</div>
			<p class="mt-2.5 text-(length:--text-small) text-chrome-muted">{t('welcome.openHint')}</p>
			<div class="footer">
				<p>
					{t('welcome.classicBefore')}<button
						type="button"
						class="link"
						onclick={() => (ui.layoutPreset = 'classic')}>{t('welcome.classicLink')}</button
					>{t('welcome.classicAfter')}
				</p>
				<p>
					{t('welcome.pressBefore')}
					<Kbd>?</Kbd>
					{t('welcome.pressAfter')}.
				</p>
				<p>
					{t('welcome.byBefore')}<a class="link" href="https://ethercorps.io" rel="noopener"
						>{t('welcome.byLink')}</a
					>{t('welcome.byAfter')}<a
						class="link"
						href="https://github.com/theetherGit/Aster"
						rel="noopener">{t('welcome.sourceLink')}</a
					>.
				</p>
			</div>
		</div>

		<div class="right">
			<div class="card sample">
				<div class="preview">
					{#if sampleThumb}
						<img src={sampleThumb} alt={t('welcome.sampleLabel')} />
					{/if}
				</div>
				<div class="flex items-center gap-3 px-3.5 py-3">
					<div class="min-w-0 flex-1">
						<p class="text-(length:--text-body) font-semibold">{t('welcome.sampleTitle')}</p>
						<p class="mt-0.5 text-(length:--text-small) text-chrome-muted">
							{t('welcome.sampleBody')}
						</p>
					</div>
					<Button size="sm" class="shrink-0" onclick={explore}>
						<span>{t('welcome.sample')}</span>
						<Icon name="arrow-right" size={13} />
					</Button>
				</div>
			</div>

			<div class="card recent">
				<div class="mb-1.5 flex h-6 items-center">
					<h2
						class="text-(length:--text-caption) font-semibold tracking-[0.05em] text-chrome-muted uppercase"
					>
						{t('welcome.recent')}
					</h2>
					<span class="flex-1"></span>
					{#if persist.recent.length}
						<Button variant="ghost" size="sm" onclick={() => clearRecent()}
							>{t('welcome.clear')}</Button
						>
					{/if}
				</div>
				{#if persist.recent.length}
					<ul class="flex flex-col">
						{#each persist.recent as r (r.id)}
							<li>
								<button type="button" class="row" onclick={() => recent(r.id)}>
									<span class="thumb" aria-hidden="true">
										{#if r.thumbnail}<img src={r.thumbnail} alt="" />{/if}
									</span>
									<span class="min-w-0 flex-1 truncate text-start" title={r.fileName ?? r.name}
										>{r.fileName ?? r.name}</span
									>
									<span class="text-(length:--text-caption) text-chrome-muted"
										>{r.fileName ? '' : t('welcome.inBrowser')}</span
									>
									<span class="w-14 text-end text-(length:--text-small) text-chrome-muted"
										>{ago(r.at, now)}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="pt-1.5 pb-2 text-(length:--text-small) text-chrome-muted">
						{t('welcome.recentEmpty')}
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.welcome {
		--hairline-plate: var(--chrome-bg);
		position: absolute;
		inset: 0;
		/* The toast's layer: over every panel of the editor beneath, under the import notice. */
		z-index: var(--z-toast);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		color: var(--chrome-text);
		background: var(--chrome-bg);
	}
	/* The board's composition (440 : 560, gap 64, 1064 wide at 1280 px), zoomed as a whole in
	   steps with the window, so a wide screen gets a larger welcome, not a wider margin. */
	.columns {
		--welcome-zoom: 1;
		display: grid;
		grid-template-columns: minmax(0, 11fr) minmax(0, 14fr);
		gap: var(--space-16);
		align-items: center;
		width: min(100% - var(--space-12), 1064px);
		padding: var(--space-6) 0;
		zoom: var(--welcome-zoom);
	}
	@media (min-width: 1440px) {
		.columns {
			--welcome-zoom: 1.2;
		}
	}
	@media (min-width: 1800px) {
		.columns {
			--welcome-zoom: 1.4;
		}
	}
	@media (min-width: 2200px) {
		.columns {
			--welcome-zoom: 1.6;
		}
	}
	@media (min-width: 2600px) {
		.columns {
			--welcome-zoom: 1.8;
		}
	}
	@media (max-width: 900px) {
		.columns {
			grid-template-columns: minmax(0, 560px);
			gap: var(--space-10);
			width: min(100% - var(--space-12), 560px);
		}
	}
	.figure {
		width: 200px;
	}
	.left {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	code {
		font-family: var(--font-mono);
		font-size: var(--text-body);
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		max-width: 360px;
		margin-top: var(--space-6);
	}
	/* The two actions are full-width rows with the key at the far end (board 07). */
	/* Board 07: the two actions are 40 px, taller than the chrome's 32 px bar buttons. */
	.actions :global(.action) {
		justify-content: space-between;
		width: 100%;
		height: var(--space-10);
		font-size: var(--text-field);
	}
	/* The quiet cap reads muted; on the primary fill it must read in the fill's own ink. */
	.actions :global(.action.primary kbd) {
		color: var(--on-accent);
	}
	.footer {
		width: 100%;
		max-width: 360px;
		margin-top: var(--space-8);
		padding-top: var(--space-4);
		font-size: var(--text-small);
		line-height: 1.6;
		color: var(--chrome-muted);
		border-top: 1px solid var(--chrome-border);
	}
	.link {
		color: var(--accent-text);
		text-decoration: underline;
	}
	.right {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.card {
		overflow: hidden;
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-card);
	}
	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 236px;
		background-color: var(--paper-bg);
		background-image: radial-gradient(var(--paper-grid) 1px, transparent 1px);
		background-size: 16px 16px;
		border-bottom: 1px solid var(--chrome-border);
	}
	.preview img {
		max-width: calc(100% - var(--space-8));
		max-height: 216px;
	}
	.recent {
		padding: var(--space-3) var(--space-4) var(--space-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: 36px;
		padding: 0 var(--space-2);
		font-size: var(--text-body);
		color: var(--chrome-text);
		border-radius: var(--control-radius);
	}
	.row:hover {
		background: var(--chrome-bg);
	}
	.thumb {
		flex-shrink: 0;
		width: var(--space-10);
		height: 26px;
		overflow: hidden;
		background: var(--paper-bg);
		border: 1px solid var(--chrome-border);
		border-radius: 3px;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
