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
	import Icon from './Icon.svelte';

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
	let newButton: HTMLButtonElement;
	// Keys from the registry, formatted for the platform (⌘ on macOS, Ctrl elsewhere).
	const key = (id: string) => {
		const k = byId(id)?.keys[0];
		return k ? format(k) : '';
	};
	// "3 min ago" in Recent has to move; a 30 s tick keeps it honest while the page is up.
	let now = $state(Date.now());
	onMount(() => {
		newButton.focus();
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

<section class="welcome" aria-labelledby="welcome-title">
	<div class="columns">
		<div class="left">
			<div
				class="figure"
				use:hairline={{ figure: aster, label: t('welcome.figure'), intensity: 0.4, play: false }}
			></div>
			<h1 id="welcome-title" class="mt-2 text-[28px] leading-tight font-semibold tracking-tight">
				{t('welcome.title')}
			</h1>
			<p class="mt-2 max-w-[400px] text-[14px] leading-normal text-chrome-muted">
				{#each tagline as part, i (i)}
					{#if part === '.mdj' || part === '.aster'}<code>{part}</code>{:else}{part}{/if}
				{/each}
			</p>
			<div class="actions">
				<button
					type="button"
					class="action primary"
					bind:this={newButton}
					onclick={() => goto(resolve('/design/[slug]', { slug: 'new' }))}
				>
					<span>{t('welcome.new')}</span>
					<kbd>{key('file.new')}</kbd>
				</button>
				<button type="button" class="action" onclick={open}>
					<span class="inline-flex items-baseline gap-1.5">
						<span>{t('welcome.open')}</span>
						<span class="text-[12.5px] text-chrome-muted">{t('welcome.openFormats')}</span>
					</span>
					<kbd>{key('file.open')}</kbd>
				</button>
			</div>
			<p class="mt-2.5 text-[12.5px] text-chrome-muted">{t('welcome.openHint')}</p>
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
					<kbd class="key">?</kbd>
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
						<p class="text-[13.5px] font-semibold">{t('welcome.sampleTitle')}</p>
						<p class="mt-0.5 text-[12px] text-chrome-muted">{t('welcome.sampleBody')}</p>
					</div>
					<button type="button" class="open-sample" onclick={explore}>
						<span>{t('welcome.sample')}</span>
						<Icon name="arrow-right" size={13} />
					</button>
				</div>
			</div>

			<div class="card recent">
				<div class="mb-1.5 flex h-6 items-center">
					<h2 class="text-[11px] font-semibold tracking-[0.05em] text-chrome-muted uppercase">
						{t('welcome.recent')}
					</h2>
					<span class="flex-1"></span>
					{#if persist.recent.length}
						<button type="button" class="clear" onclick={() => clearRecent()}
							>{t('welcome.clear')}</button
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
									<span class="min-w-0 flex-1 truncate text-left" title={r.fileName ?? r.name}
										>{r.fileName ?? r.name}</span
									>
									<span class="text-[11.5px] text-chrome-muted"
										>{r.fileName ? '' : t('welcome.inBrowser')}</span
									>
									<span class="w-14 text-right text-[12px] text-chrome-muted">{ago(r.at, now)}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="pt-1.5 pb-2 text-[12.5px] text-chrome-muted">{t('welcome.recentEmpty')}</p>
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
		z-index: 30;
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
		gap: 64px;
		align-items: center;
		width: min(100% - 48px, 1064px);
		padding: 24px 0;
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
			gap: 40px;
			width: min(100% - 48px, 560px);
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
		font-family: ui-monospace, Menlo, monospace;
		font-size: 13px;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		max-width: 360px;
		margin-top: 24px;
	}
	.action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		height: 40px;
		padding: 0 12px 0 14px;
		font-size: 13.5px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-control);
	}
	.action:hover {
		border-color: var(--accent);
	}
	.action.primary {
		font-weight: 600;
		color: var(--on-accent);
		background: var(--accent-fill);
		border-color: var(--accent-fill);
	}
	.action kbd,
	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		font-family: ui-monospace, Menlo, monospace;
		font-size: 11px;
		line-height: 1;
		white-space: nowrap;
		color: var(--chrome-text);
		background: var(--chrome-bg);
		border: 1px solid var(--chrome-border);
		border-bottom-width: 2px;
		border-radius: 4px;
	}
	.action.primary kbd {
		color: var(--on-accent);
		background: transparent;
		border-color: transparent;
	}
	.key {
		min-width: 18px;
		height: 18px;
		font-size: 10px;
		vertical-align: middle;
	}
	.footer {
		width: 100%;
		max-width: 360px;
		margin-top: 28px;
		padding-top: 14px;
		font-size: 12.5px;
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
		gap: 16px;
	}
	.card {
		overflow: hidden;
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 12px;
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
		max-width: calc(100% - 32px);
		max-height: 216px;
	}
	.open-sample,
	.clear {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 12px;
		font-size: 12.5px;
		white-space: nowrap;
		color: var(--chrome-text);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-control);
	}
	.open-sample:hover {
		border-color: var(--accent);
	}
	.clear {
		height: 24px;
		padding: 0 8px;
		font-size: 11.5px;
		color: var(--chrome-muted);
		border-color: transparent;
		border-radius: 5px;
	}
	.clear:hover {
		border-color: var(--chrome-border);
	}
	.recent {
		padding: 12px 14px 8px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 36px;
		padding: 0 6px;
		font-size: 13px;
		color: var(--chrome-text);
		border-radius: var(--radius-control);
	}
	.row:hover {
		background: var(--chrome-bg);
	}
	.thumb {
		flex-shrink: 0;
		width: 40px;
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
