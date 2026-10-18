<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { markSeen, openSaved, persist } from '#lib/persist/autosave.svelte.ts';
	import { newProject, openFromPicker } from '#lib/persist/files.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { ago } from './time.ts';
	import { exploded } from '@lucasmarkes/hairline';
	import { hairline } from '#lib/actions/hairline.ts';

	// Board 07: first visit. Three cards; the sample diagram waits behind (owner's #1).
	function explore() {
		ui.welcome = false;
		ui.sampleStrip = true;
		markSeen();
	}
	async function recent(id: string) {
		if (await openSaved(id)) {
			ui.welcome = false;
			markSeen();
		}
	}
</script>

<section class="welcome" aria-labelledby="welcome-title">
	<div class="inner">
		<div
			class="mx-auto mb-4 w-[200px]"
			use:hairline={{ figure: exploded, label: t('welcome.figure'), intensity: 0.4, play: false }}
		></div>
		<h2 id="welcome-title" class="text-[28px] font-semibold">{t('welcome.title')}</h2>
		<p class="mt-1 text-[14px] text-chrome-muted">{t('welcome.tagline')}</p>
		<div class="cards">
			<button type="button" class="card" onclick={() => newProject().then(markSeen)}>
				<span class="icon accent" aria-hidden="true">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg
					>
				</span>
				<span class="card-title">{t('welcome.new')}</span>
				<span class="card-hint">{t('welcome.newHint')}</span>
				<kbd>{t('file.newShortcut')}</kbd>
			</button>
			<button type="button" class="card" onclick={() => openFromPicker().then(markSeen)}>
				<span class="icon" aria-hidden="true">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><path
							d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
						/></svg
					>
				</span>
				<span class="card-title">{t('welcome.open')}</span>
				<span class="card-hint">{t('welcome.openHint')}</span>
				<kbd>{t('file.openShortcut')}</kbd>
			</button>
			<div class="card static">
				<span class="card-title">{t('welcome.recent')}</span>
				{#if persist.recent.length}
					<ul class="mt-1 flex flex-col">
						{#each persist.recent.slice(0, 5) as r (r.id)}
							<li>
								<button type="button" class="recent-row" onclick={() => recent(r.id)}>
									{#if r.thumbnail}<img src={r.thumbnail} alt="" width="40" height="26" />{/if}
									<span class="truncate">{r.fileName ?? r.name}</span>
									<span class="ml-auto shrink-0 text-chrome-muted">{ago(r.at)}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<span class="card-hint">{t('welcome.recentEmpty')}</span>
				{/if}
			</div>
		</div>
		<button type="button" class="mt-6 text-[13px] text-accent hover:underline" onclick={explore}
			>{t('welcome.sample')}</button
		>
		<p class="mt-4 text-[13px] text-chrome-muted">
			{t('welcome.pressBefore')}
			<kbd class="rounded border border-chrome-border px-1.5 text-chrome-text">?</kbd>
			{t('welcome.pressAfter')}
		</p>
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
		background: var(--chrome-bg);
	}
	.inner {
		max-width: 1120px;
		padding: 24px;
		text-align: center;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(220px, 360px));
		gap: 24px;
		margin-top: 32px;
		text-align: left;
	}
	@media (max-width: 900px) {
		.cards {
			grid-template-columns: 1fr;
		}
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-height: 180px;
		padding: 20px 28px 24px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 12px;
	}
	.card:not(.static):hover {
		border-color: var(--accent);
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		margin-bottom: 16px;
		border-radius: 8px;
		background: var(--chrome-bg);
	}
	.icon.accent {
		color: var(--on-accent);
		background: var(--accent-fill);
	}
	.card-title {
		font-size: 15px;
		font-weight: 600;
	}
	.card-hint {
		font-size: 13px;
		line-height: 1.45;
		color: var(--chrome-muted);
	}
	kbd {
		margin-top: 10px;
		font-size: 11px;
		color: var(--chrome-muted);
	}
	.recent-row {
		display: flex;
		gap: 8px;
		align-items: center;
		width: 100%;
		height: 32px;
		padding: 0 4px;
		font-size: 14px;
		color: var(--chrome-text);
		border-radius: 6px;
	}
	.recent-row:hover {
		background: var(--chrome-bg);
	}
	.recent-row img {
		border: 1px solid var(--chrome-border);
		border-radius: 3px;
		object-fit: cover;
	}
</style>
