<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import Canvas from '#lib/canvas/Canvas.svelte';
	import { handleGlobalKey } from '#lib/canvas/keyboard.ts';
	import { t } from '#lib/i18n/index.ts';
	import EmptyHint from '#lib/panels/EmptyHint.svelte';
	import Explorer from '#lib/panels/Explorer.svelte';
	import ExportSheet from '#lib/panels/ExportSheet.svelte';
	import ImportNotice from '#lib/panels/ImportNotice.svelte';
	import Palette from '#lib/panels/Palette.svelte';
	import ShortcutSheet from '#lib/panels/ShortcutSheet.svelte';
	import Toast from '#lib/panels/Toast.svelte';
	import Inspector from '#lib/panels/Inspector.svelte';
	import RelationshipPicker from '#lib/panels/RelationshipPicker.svelte';
	import Toolbox from '#lib/panels/Toolbox.svelte';
	import TopBar from '#lib/panels/TopBar.svelte';
	import UnsavedPrompt from '#lib/panels/UnsavedPrompt.svelte';
	import Welcome from '#lib/panels/Welcome.svelte';
	import { ago } from '#lib/panels/time.ts';
	import { firstVisit, persist, restoreLast, startAutosave } from '#lib/persist/autosave.svelte.ts';
	import { files, newProject, openDropped, saveFile } from '#lib/persist/files.svelte.ts';
	import { notationProject } from '#lib/model/fixtures.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// First visit: the welcome (board 07) over the sample. Returning: the last autosaved project.
	// `?fixture=notation` opens the UML notation fixture (visual regression and manual review).
	onMount(() => {
		const fixture = new URL(location.href).searchParams.get('fixture');
		const boot = async () => {
			if (fixture === 'notation') projectStore.load(notationProject());
			else if (firstVisit()) ui.welcome = true;
			else await restoreLast(); // nothing saved yet: the sample, no welcome
			files.savedVersion = files.current ? files.savedVersion : projectStore.version;
			persist.ready = true;
		};
		let stop = () => {};
		boot().then(
			() => (stop = startAutosave()),
			(e) => console.error('boot failed', e)
		);
		return () => stop();
	});

	const counts = $derived.by(() => {
		const d = projectStore.diagram;
		const kind = (k: string) =>
			d.elementIds.filter((id) => projectStore.project.elements.get(id)?.kind === k).length;
		return { classifiers: kind('classifier'), relationships: kind('relationship') };
	});

	// Relative times tick once a minute.
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});
	const title = $derived(
		`${files.current?.name ?? projectStore.project.name}${files.state === 'unsaved' ? ' •' : ''} – ${t('app.name')}`
	);
	$effect(() => {
		document.title = title;
	});

	const showBanner = $derived(
		files.state === 'never' &&
			projectStore.canUndo &&
			!files.bannerDismissed &&
			!ui.welcome &&
			!ui.sampleStrip
	);
	let copiedName = $state(false);
	async function copyName() {
		if (!files.current) return;
		await navigator.clipboard.writeText(files.current.name);
		copiedName = true;
		setTimeout(() => (copiedName = false), 1500);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<svelte:window
	onkeydown={handleGlobalKey}
	onbeforeunload={(e) => {
		// Edits to a file the browser cannot keep: ask. Browser-only projects are autosaved.
		if (files.state === 'unsaved') e.preventDefault();
	}}
	ondragover={(e) => {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		files.dragging = true;
	}}
	ondragleave={(e) => {
		if (!e.relatedTarget) files.dragging = false;
	}}
	ondrop={(e) => {
		if (!e.dataTransfer?.files.length) return;
		e.preventDefault();
		openDropped(e.dataTransfer.files);
	}}
/>

<!-- Modern layout (docs/spec/ui.md, boards 01–02): top bar, floating toolbox, right inspector. -->
<SvelteFlowProvider>
	<Tabs.Root bind:value={projectStore.activeDiagramId} class="grid h-dvh grid-rows-[44px_1fr]">
		<TopBar />
		<Tabs.Content value={projectStore.activeDiagramId} class="relative flex min-h-0">
			<div class="relative flex min-h-0 flex-1">
				{#if ui.panels.outline}
					<Explorer />
				{/if}
				<div
					class="relative min-w-0 flex-1"
					style:--canvas-inset-top={showBanner || ui.sampleStrip ? '40px' : '0px'}
				>
					<Canvas />
					{#if showBanner}
						<!-- ui.md save states: once per project, until saved to a file. -->
						<div class="banner" role="region" aria-label={t('file.bannerLabel')}>
							<span class="flex-1">{t('file.banner')}</span>
							<button
								type="button"
								class="h-7 rounded-control border border-current/40 px-2 hover:bg-black/5"
								onclick={() => saveFile(true)}>{t('file.bannerSave')}</button
							>
							<button
								type="button"
								class="icon-btn h-7 w-7"
								aria-label={t('file.bannerDismiss')}
								onclick={() => (files.bannerDismissed = true)}>×</button
							>
						</div>
					{/if}
					{#if ui.sampleStrip}
						<div class="banner sample" role="region" aria-label={t('welcome.sampleLabel')}>
							<span class="flex-1">{t('welcome.sampleStrip')}</span>
							<button
								type="button"
								class="h-7 rounded-control border border-current/40 px-2 hover:bg-black/5"
								onclick={() => newProject()}>{t('file.new')}</button
							>
							<button
								type="button"
								class="icon-btn h-7 w-7"
								aria-label={t('welcome.sampleDismiss')}
								onclick={() => (ui.sampleStrip = false)}>×</button
							>
						</div>
					{/if}
					{#if projectStore.diagram.elementIds.length === 0 && !ui.welcome}
						<EmptyHint />
					{/if}
					<Toolbox />
					<ImportNotice />
					<Toast />
					<footer class="footer">
						<span>{t('footer.counts', counts)}</span>
						<span aria-hidden="true">·</span>
						{#if files.current}
							<span data-testid="footer-save" data-saved={persist.at}
								>{t('footer.autosaved', {
									ago: persist.at ? ago(persist.at, now) : t('time.justNow')
								})}</span
							>
							<span aria-hidden="true">·</span>
							<button
								type="button"
								class="file-name"
								title={t('footer.copyName')}
								onclick={copyName}>{copiedName ? t('file.copied') : files.current.name}</button
							>
						{:else}
							<span data-testid="footer-save" data-saved={persist.at}>{t('footer.notSaved')}</span>
						{/if}
					</footer>
				</div>
				<Inspector />
				{#if ui.welcome}
					<Welcome />
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
	<RelationshipPicker />
	<ExportSheet />
	<Palette />
	<ShortcutSheet />
	<UnsavedPrompt />
	{#if files.dragging}
		<!-- Board 21: the whole window is the drop target. -->
		<div class="drop-overlay">
			<div class="drop-card" role="status">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path
						d="M12 11v6M9 14l3 3 3-3"
					/></svg
				>
				<p class="drop-title">{t('file.dropTitle')}</p>
				<p class="drop-hint">{t('file.dropHint')}</p>
			</div>
		</div>
	{/if}
</SvelteFlowProvider>

<style>
	.footer {
		position: absolute;
		bottom: 18px;
		left: 22px;
		z-index: 5;
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		color: var(--chrome-muted);
	}
	.footer > span {
		pointer-events: none;
	}
	.file-name {
		height: 24px;
		padding: 0 4px;
		color: var(--chrome-muted);
		border-radius: 4px;
	}
	.file-name:hover {
		color: var(--chrome-text);
		background: var(--chrome-surface);
	}
	.banner {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		z-index: 25;
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 6px 14px;
		font-size: 13px;
		color: #3f2a00;
		background: color-mix(in srgb, var(--warning) 22%, var(--chrome-surface));
		border-bottom: 1px solid var(--chrome-border);
	}
	.banner.sample {
		color: var(--chrome-text);
		background: color-mix(in srgb, var(--accent) 14%, var(--chrome-surface));
	}
	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		pointer-events: none;
	}
	.drop-overlay::after {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2px dashed var(--accent);
		border-radius: 10px;
	}
	.drop-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 22px 40px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 12px;
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.22);
	}
	.drop-card svg {
		box-sizing: content-box;
		padding: 8px;
		color: var(--on-accent);
		background: var(--accent-fill);
		border-radius: 8px;
	}
	.drop-title {
		font-size: 15px;
		font-weight: 600;
	}
	.drop-hint {
		font-size: 12px;
		color: var(--chrome-muted);
	}
</style>
