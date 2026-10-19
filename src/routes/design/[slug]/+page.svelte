<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { useInterval } from 'runed';
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
	import MenuBar from '#lib/panels/classic/MenuBar.svelte';
	import ClassicToolbar from '#lib/panels/classic/ClassicToolbar.svelte';
	import ClassicToolbox from '#lib/panels/classic/ClassicToolbox.svelte';
	import WorkingDiagrams from '#lib/panels/classic/WorkingDiagrams.svelte';
	import UnsavedPrompt from '#lib/panels/UnsavedPrompt.svelte';
	import { ago } from '#lib/panels/time.ts';
	import {
		loadRecent,
		openBySlug,
		openDraft,
		persist,
		startAutosave
	} from '#lib/persist/autosave.svelte.ts';
	import {
		files,
		guardUnsaved,
		loadFixture,
		newProject,
		openDropped,
		saveFile
	} from '#lib/persist/files.svelte.ts';
	import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { announce } from '#lib/stores/live.svelte.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { resolve } from '$app/paths';

	// `/design/<slug>`: `new` is the unnamed draft (restored when one exists, else fresh), `sample`
	// the bundled sample with its strip, `notation` the UML notation fixture (visual regression and
	// manual review), anything else a project in this browser by its slug. The welcome may have
	// loaded the project already, in which case `persist.route` is this slug and nothing reloads.
	onMount(() => {
		const slug = page.params.slug!;
		const boot = async () => {
			await loadRecent();
			if (persist.route !== slug) {
				if (slug === 'new') {
					if (!(await openDraft())) await newProject();
				} else if (slug === 'sample') {
					loadFixture(sampleProject(), 'sample');
					ui.sampleStrip = true;
				} else if (slug === 'notation') loadFixture(notationProject(), 'notation');
				else if (!(await openBySlug(slug))) {
					await goto(resolve('/'));
					return;
				}
			}
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

	// The URL follows the open project: a draft that gets a name, a file opened over this one. Only
	// the address changes; no navigation runs, so the editor keeps its state and focus.
	$effect(() => {
		const route = persist.route;
		if (route && location.pathname !== resolve('/design/[slug]', { slug: route }))
			replaceState(resolve('/design/[slug]', { slug: route }), {});
	});

	// Board 20 on the way out: leaving the editor with unsaved edits to a file asks first.
	let leaving = false;
	beforeNavigate((nav) => {
		if (leaving || nav.type === 'leave' || !nav.to || files.state !== 'unsaved') return;
		nav.cancel();
		const url = nav.to.url;
		guardUnsaved(null, async () => {
			leaving = true;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- SvelteKit's own, already resolved
			await goto(url);
		});
	});

	// Two arrangements of the same panels (overview.md): Modern, boards 01–02, and Classic, board
	// 03. The canvas column is shared, so switching keeps the canvas mounted: selection, zoom and
	// unsaved state stay (features.md, Classic layout).
	const classic = $derived(ui.layoutPreset === 'classic');

	const counts = $derived.by(() => {
		const d = projectStore.diagram;
		const kind = (k: string) =>
			d.elementIds.filter((id) => projectStore.project.elements.get(id)?.kind === k).length;
		return { classifiers: kind('classifier'), relationships: kind('relationship') };
	});

	// Relative times tick once a minute.
	let now = $state(Date.now());
	useInterval(30_000, { callback: () => (now = Date.now()) });
	const title = $derived(
		t('app.windowTitle', {
			name: files.current?.name ?? projectStore.project.name,
			dirty: files.state === 'unsaved' ? t('app.windowTitleDirty') : ''
		})
	);
	const countsText = $derived(
		t('footer.counts', {
			classifiers: t(counts.classifiers === 1 ? 'footer.classifierOne' : 'footer.classifiers', {
				n: counts.classifiers
			}),
			relationships: t(
				counts.relationships === 1 ? 'footer.relationshipOne' : 'footer.relationships',
				{ n: counts.relationships }
			)
		})
	);

	// Switching layout unmounts the bar that held focus; the canvas takes it (focus is never lost).
	let lastPreset = ui.layoutPreset;
	$effect(() => {
		if (ui.layoutPreset === lastPreset) return;
		lastPreset = ui.layoutPreset;
		canvasFocus.focus();
	});

	// keyboard.md: F6 / ⇧F6 cycle the open panels (Outline, canvas, Inspector) in DOM order.
	function cyclePanels(back: boolean) {
		const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
		if (!panels.length) return;
		const current = panels.findIndex((p) => p.contains(document.activeElement));
		const next = panels[(current + (back ? -1 : 1) + panels.length) % panels.length];
		const target = next.querySelector<HTMLElement>(
			'[role="application"], [tabindex="0"], button:not([disabled]), input, textarea, select, a[href]'
		);
		target?.focus();
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'F6') {
			e.preventDefault();
			cyclePanels(e.shiftKey);
			return;
		}
		handleGlobalKey(e);
	}
	$effect(() => {
		document.title = title;
	});

	const showBanner = $derived(
		files.state === 'never' && projectStore.canUndo && !files.bannerDismissed && !ui.sampleStrip
	);
	let copiedName = $state(false);
	async function copyName() {
		if (!files.current) return;
		try {
			await navigator.clipboard.writeText(files.current.name);
		} catch {
			announce(t('file.copyFailed'));
			return;
		}
		copiedName = true;
		announce(t('file.copied'));
		setTimeout(() => (copiedName = false), 1500);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<svelte:window
	{onkeydown}
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

<SvelteFlowProvider>
	<a href="#canvas" class="skip-link" onclick={(e) => (e.preventDefault(), canvasFocus.focus())}
		>{t('app.skipToCanvas')}</a
	>
	<Tabs.Root
		bind:value={projectStore.activeDiagramId}
		class="grid h-dvh {classic ? 'grid-rows-[auto_1fr]' : 'grid-rows-[44px_1fr]'}"
		data-layout={ui.layoutPreset}
	>
		{#if classic}
			<div>
				<MenuBar />
				{#if ui.classic.toolbar}
					<ClassicToolbar />
				{/if}
			</div>
		{:else}
			<TopBar />
		{/if}
		<Tabs.Content value={projectStore.activeDiagramId} class="relative flex min-h-0">
			<div class="relative flex min-h-0 flex-1">
				{#if classic}
					{#if ui.classic.sidebar}
						<aside
							class="classic-column left"
							aria-label={t('classic.sidebar')}
							data-panel="sidebar"
						>
							<WorkingDiagrams />
							{#if ui.classic.toolbox}
								<ClassicToolbox />
							{/if}
						</aside>
					{/if}
				{:else if ui.panels.outline}
					<div class="contents" data-panel="outline"><Explorer /></div>
				{/if}
				<main
					id="canvas"
					class="relative min-w-0 flex-1"
					style:--canvas-inset-top={showBanner || ui.sampleStrip ? '40px' : '0px'}
					data-panel="canvas"
				>
					<!-- The toolbox precedes the canvas in the DOM so Tab reaches the canvas after it. -->
					{#if !classic}
						<Toolbox />
					{/if}
					<Canvas />
					{#if showBanner}
						<!-- ui.md save states: once per project, until saved to a file. -->
						<div class="banner" role="region" aria-label={t('file.bannerLabel')}>
							<span class="flex-1"
								>{t('file.banner', { key: format(byId('file.save')!.keys[0]) })}</span
							>
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
					{#if projectStore.diagram.elementIds.length === 0}
						<EmptyHint />
					{/if}
					<ImportNotice />
					<Toast />
					{#if !classic || ui.classic.statusbar}
						<footer class="footer">
							<span>{countsText}</span>
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
								<span data-testid="footer-save" data-saved={persist.at}>{t('footer.notSaved')}</span
								>
							{/if}
						</footer>
					{/if}
				</main>
				{#if classic}
					{#if ui.classic.navigator || ui.classic.editors}
						<aside
							class="classic-column right"
							aria-label={t('classic.rightColumn')}
							data-panel="right"
						>
							{#if ui.classic.navigator}
								<Explorer variant="classic" />
							{/if}
							{#if ui.classic.editors}
								<Inspector variant="classic" />
							{/if}
						</aside>
					{/if}
				{:else}
					<div class="contents" data-panel="inspector"><Inspector /></div>
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
	/* Board 03: 200 px left column, 280 px right column, grey chrome, 1 px separators. */
	.classic-column {
		display: flex;
		flex-shrink: 0;
		flex-direction: column;
		min-height: 0;
		font-size: 12.5px;
		background: var(--chrome-bg);
	}
	.classic-column.left {
		width: 200px;
		border-right: 1px solid var(--chrome-border);
	}
	.classic-column.right {
		width: 280px;
		border-left: 1px solid var(--chrome-border);
	}
	/* The footer sits on the paper, which is white in every theme, so its text and plate are paper-side. */
	.footer {
		position: absolute;
		bottom: 14px;
		left: 16px;
		z-index: 5;
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 2px 6px;
		font-size: 12px;
		color: var(--paper-muted);
		background: color-mix(in srgb, var(--paper-bg) 88%, transparent);
		border-radius: 4px;
	}
	.skip-link {
		position: absolute;
		top: -100px;
		left: 8px;
		z-index: 70;
		padding: 6px 10px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--control-radius);
	}
	.skip-link:focus-visible {
		top: 8px;
	}
	.footer > span {
		pointer-events: none;
	}
	.file-name {
		height: 24px;
		padding: 0 4px;
		color: var(--paper-muted);
		border-radius: 4px;
	}
	.file-name:hover {
		color: var(--paper-ink);
		background: var(--paper-grid);
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
		color: var(--chrome-text);
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
