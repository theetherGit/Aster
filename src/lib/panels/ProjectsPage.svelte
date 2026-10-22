<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { sieve } from '@lucasmarkes/hairline';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.ts';
	import {
		allProjects,
		deleteAllProjects,
		forget,
		loadRecent,
		openSaved,
		persist,
		storedFile,
		type RecentEntry
	} from '#lib/persist/autosave.svelte.ts';
	import { announce } from '#lib/stores/live.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import EmptyState from '#lib/ui/molecules/EmptyState.svelte';
	import { ago } from './time.ts';

	// Owner's request (2026-10-22): every project this browser keeps, not only Recent's last 10,
	// to open, download or delete. Each delete asks first; deleting all says what goes with it.
	let list = $state<RecentEntry[] | null>(null);
	let used = $state<string | null>(null);
	let asking = $state<RecentEntry | 'all' | null>(null);
	let now = $state(Date.now());
	let section: HTMLElement;

	const nameOf = (p: RecentEntry) => p.fileName ?? (p.name || t('model.untitled'));
	async function refresh() {
		list = await allProjects();
		const estimate = await navigator.storage?.estimate?.();
		used =
			estimate?.usage !== undefined
				? t('projects.used', { mb: (estimate.usage / 1024 / 1024).toFixed(1) })
				: null;
	}
	onMount(() => {
		loadRecent().then(refresh);
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	async function open(p: RecentEntry) {
		if (await openSaved(p.id))
			await goto(resolve('/design/[slug]', { slug: persist.route ?? 'new' }));
	}
	async function download(p: RecentEntry) {
		const file = await storedFile(p.id);
		if (!file) return announce(t('projects.unreadable', { name: nameOf(p) }));
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }));
		a.download = file.name;
		a.hidden = true;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}
	/** After a delete, focus goes to the next row's Open, else the heading: never to the page. */
	async function confirmed() {
		const target = asking;
		asking = null;
		if (!target) return;
		const index = target === 'all' ? 0 : (list?.findIndex((p) => p.id === target.id) ?? 0);
		if (target === 'all') await deleteAllProjects();
		else await forget(target.id);
		announce(
			target === 'all' ? t('projects.deletedAll') : t('projects.deleted', { name: nameOf(target) })
		);
		await refresh();
		await tick();
		const opens = section.querySelectorAll<HTMLElement>('[data-open]');
		(opens[Math.min(index, opens.length - 1)] ?? section.querySelector('h1'))?.focus();
	}
</script>

<section bind:this={section} class="projects" aria-labelledby="projects-title">
	<div class="column">
		<a class="link back" href={resolve('/')}>{t('projects.back')}</a>
		<div class="mt-4 flex items-start gap-4">
			<div class="min-w-0 flex-1">
				<h1 id="projects-title" tabindex="-1" class="text-(length:--text-title) font-semibold">
					{t('projects.title')}
				</h1>
				<p class="mt-1 text-(length:--text-body) text-chrome-muted">
					{t('projects.intro')}{#if used}
						{used}{/if}
				</p>
			</div>
			{#if list?.length}
				<Button variant="ghost" size="sm" class="shrink-0" onclick={() => (asking = 'all')}
					>{t('projects.deleteAll')}</Button
				>
			{/if}
		</div>

		{#if list === null}
			<p class="mt-6 text-(length:--text-body) text-chrome-muted" role="status">
				{t('projects.loading')}
			</p>
		{:else if !list.length}
			<EmptyState
				class="mt-10"
				figure={sieve}
				title={t('projects.empty')}
				description={t('projects.emptyBody')}
				label={t('projects.emptyFigure')}
				plate="bg"
			/>
		{:else}
			<ul class="mt-5 flex flex-col gap-1" aria-label={t('projects.list')}>
				{#each list as p (p.id)}
					<li class="row">
						<span class="thumb" aria-hidden="true">
							{#if p.thumbnail}<img src={p.thumbnail} alt="" />{/if}
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold" title={nameOf(p)}>{nameOf(p)}</p>
							<p class="truncate text-(length:--text-small) text-chrome-muted">
								{p.fileName ? t('projects.fromFile') : t('welcome.inBrowser')} · {t(
									'projects.saved',
									{ ago: ago(p.at, now) }
								)}{#if !persist.recent.some((r) => r.id === p.id)}
									· {t('projects.notInRecent')}{/if}
							</p>
						</div>
						<Button
							size="sm"
							data-open=""
							aria-label={t('projects.openNamed', { name: nameOf(p) })}
							onclick={() => open(p)}>{t('projects.open')}</Button
						>
						<Button
							variant="ghost"
							size="sm"
							aria-label={t('projects.downloadNamed', { name: nameOf(p) })}
							onclick={() => download(p)}>{t('projects.download')}</Button
						>
						<IconButton
							label={t('projects.deleteNamed', { name: nameOf(p) })}
							icon="trash"
							onclick={() => (asking = p)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<DialogFrame
	bind:open={() => asking !== null, (o) => !o && (asking = null)}
	alert
	title={asking === 'all'
		? t('welcome.clearTitle')
		: t('projects.deleteTitle', { name: asking ? nameOf(asking) : '' })}
	description={asking === 'all'
		? t('welcome.clearBody')
		: asking?.fileName
			? t('projects.deleteBodyFile')
			: t('projects.deleteBody')}
>
	{#snippet actions()}
		<Button variant="ghost" onclick={() => (asking = null)}>{t('confirm.cancel')}</Button>
		<Button variant="danger" onclick={confirmed}
			>{asking === 'all' ? t('projects.deleteAllConfirm') : t('confirm.delete')}</Button
		>
	{/snippet}
</DialogFrame>

<style>
	.projects {
		position: absolute;
		inset: 0;
		overflow: auto;
		color: var(--chrome-text);
		background: var(--chrome-bg);
	}
	.column {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-12) var(--space-6);
	}
	.link {
		color: var(--accent-text);
		text-decoration: underline;
	}
	.back {
		font-size: var(--text-body);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 56px;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-body);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-card);
	}
	.thumb {
		flex-shrink: 0;
		width: var(--space-16);
		height: 40px;
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
	/* A narrow window keeps the name and the three actions; the picture goes. */
	@media (max-width: 480px) {
		.thumb {
			display: none;
		}
	}
</style>
