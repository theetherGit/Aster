<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { useInterval } from 'runed';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { Tabs } from 'bits-ui';
	import Canvas from '#lib/canvas/Canvas.svelte';
	import ValidationPanel from '#lib/panels/ValidationPanel.svelte';
	import QuickFind from '#lib/panels/QuickFind.svelte';
	import { validate } from '#lib/model/validate.ts';
	import { validation } from '#lib/stores/validation.svelte.ts';
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
	import ConfirmDeleteDialog from '#lib/panels/ConfirmDeleteDialog.svelte';
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
		watchOutside
	} from '#lib/persist/files.svelte.ts';
	import { downloadMdj } from '#lib/export/actions.ts';
	import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
	import { demoProject } from '#lib/model/demo.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { announce, live } from '#lib/stores/live.svelte.ts';
	import { motion } from '#lib/ui/motion.ts';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { byId, runCommand } from '#lib/app/commands.svelte.ts';
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/atoms/Button.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import Banner from '#lib/ui/molecules/Banner.svelte';

	// `/design/<slug>`: `new` is the unnamed draft (restored when one exists, else fresh), `sample`
	// the bundled sample with its strip, `demo` Aster's own design with the same strip, `notation` the UML notation fixture (visual regression and
	// manual review), anything else a project in this browser by its slug. The welcome may have
	// loaded the project already, in which case `persist.route` is this slug and nothing reloads.
	onMount(() => {
		motion.leaving = false;
		const slug = page.params.slug!;
		const boot = async () => {
			await loadRecent();
			if (persist.route !== slug) {
				if (slug === 'new') {
					if (!(await openDraft())) await newProject(false);
				} else if (slug === 'sample' || slug === 'demo') {
					loadFixture(slug === 'demo' ? demoProject() : sampleProject(), slug);
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
		if (leaving || nav.type === 'leave' || !nav.to || files.state !== 'unsaved') {
			// Panels do not slide shut on a page that is going away; the flag resets on the next mount.
			motion.leaving = true;
			return;
		}
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
		return {
			objects: d.diagramKind === 'object',
			classifiers: kind('classifier'),
			relationships: kind('relationship'),
			instances: kind('instance'),
			links: kind('link')
		};
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
		counts.objects
			? t('footer.counts', {
					classifiers: t(counts.instances === 1 ? 'footer.objectOne' : 'footer.objects', {
						n: counts.instances
					}),
					relationships: t(counts.links === 1 ? 'footer.linkOne' : 'footer.links', {
						n: counts.links
					})
				})
			: t('footer.counts', {
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

	// features.md M2: rules run live, a moment after the model settles, so a drag (many commands)
	// validates once at the end rather than every frame.
	$effect(() => {
		void projectStore.version;
		const project = projectStore.project;
		const h = setTimeout(() => (validation.findings = validate(project)), 120);
		return () => clearTimeout(h);
	});

	// Owner's ruling #22: watch the open file for changes made outside Aster.
	$effect(() => watchOutside());

	// keyboard.md: F6 / ⇧F6 cycle the open panels (Outline, canvas, Inspector) in DOM order.
	function cyclePanels(back: boolean) {
		const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
		if (!panels.length) return;
		const current = panels.findIndex((p) => p.contains(document.activeElement));
		const next = panels[(current + (back ? -1 : 1) + panels.length) % panels.length];
		// The first candidate that takes focus: a disabled tab or a hidden control is skipped.
		for (const target of next.querySelectorAll<HTMLElement>(
			'[role="application"], [tabindex="0"], button:not([disabled]), input, textarea, select, a[href]'
		)) {
			target.focus();
			if (document.activeElement === target) return;
		}
	}
	// Esc at the top of the canvas's levels hands focus on, the same as F6 (accessibility.md).
	$effect(() => {
		canvasFocus.leave = () => cyclePanels(false);
		return () => (canvasFocus.leave = () => {});
	});
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

	const bannerDue = $derived(
		files.state === 'never' && projectStore.canUndo && !files.bannerDismissed && !ui.sampleStrip
	);
	// Owner's ruling (2026-10-22): the ⌘S notice stands in for the banner while it is up, so one
	// Download .mdj shows. The banner's room is kept (bannerDue), so the toolbox does not jump.
	const showBanner = $derived(bannerDue && !ui.toast?.save);
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
	<!-- The editor is one app, not pages to rank: only the welcome is indexed (sitemap.xml). -->
	<meta name="robots" content="noindex" />
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
				{:else}
					<!-- The Outline's rail, the mirror of the inspector's: one button to bring it back. -->
					<aside
						aria-label={t('explorer.collapsed')}
						class="flex w-10 shrink-0 justify-center border-e border-chrome-border bg-chrome-surface pt-2"
					>
						<IconButton
							label={t('explorer.show')}
							icon="panel-left"
							key={format(byId('view.outline')!.keys[0])}
							onclick={() => runCommand('view.outline')}
						/>
					</aside>
				{/if}
				<!-- The validation panel sits under the canvas, in its column (StarUML's bottom panel). -->
				<div class="flex min-w-0 flex-1 flex-col">
					<main
						id="canvas"
						class="relative min-h-0 min-w-0 flex-1"
						style:--canvas-inset-top={bannerDue || ui.sampleStrip ? '40px' : '0px'}
						data-panel="canvas"
					>
						<!-- The toolbox precedes the canvas in the DOM so Tab reaches the canvas after it. -->
						{#if !classic}
							<Toolbox />
						{/if}
						<Canvas />
						{#if showBanner}
							<!-- ui.md save states: once per project, until saved to a file. -->
							<Banner
								tone="warning"
								label={t('file.bannerLabel')}
								text={t('file.banner', { key: format(byId('file.save')!.keys[0]) })}
								dismissLabel={t('file.bannerDismiss')}
								ondismiss={() => (files.bannerDismissed = true)}
							>
								{#snippet actions()}
									<Button size="sm" onclick={() => runCommand('project.rename')}
										>{t('file.bannerName')}</Button
									>
									<Button size="sm" onclick={() => downloadMdj()}>{t('file.bannerSave')}</Button>
								{/snippet}
							</Banner>
						{/if}
						{#if ui.sampleStrip}
							<Banner
								tone="info"
								label={t('welcome.sampleLabel')}
								text={t('welcome.sampleStrip', { key: format(byId('file.new')!.keys[0]) })}
								dismissLabel={t('welcome.sampleDismiss')}
								ondismiss={() => (ui.sampleStrip = false)}
							>
								{#snippet actions()}
									<Button size="sm" onclick={() => newProject()}>{t('file.new')}</Button>
								{/snippet}
							</Banner>
						{/if}
						{#if projectStore.diagram.elementIds.length === 0}
							<EmptyHint />
						{/if}
						<ImportNotice />
						<Toast />
						{#if ui.captions}
							<!-- ui.md: with captions on, the footer becomes the narration bar (board 10). The live
						     region already speaks each line, so the bar is for eyes only. -->
							<div class="narration" data-testid="narration" aria-hidden="true">
								<span class="narration-tag">{t('ui.announced')}</span>
								<span>{live.text}</span>
							</div>
						{:else if !classic || ui.classic.statusbar}
							<footer class="footer">
								<span>{countsText}</span>
								{#if ui.layingOut}
									<span aria-hidden="true">·</span>
									<span data-testid="footer-layout">{t('layout.working')}</span>
								{/if}
								{#if validation.findings.length}
									<span aria-hidden="true">·</span>
									<button
										type="button"
										class="file-name warnings"
										aria-expanded={validation.open}
										onclick={() => (validation.open = !validation.open)}
										>{validation.findings.length === 1
											? t('validation.countOne')
											: t('validation.count', { n: validation.findings.length })}</button
									>
								{/if}
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
									<span data-testid="footer-save" data-saved={persist.at}
										>{t('footer.notSaved')}</span
									>
								{/if}
							</footer>
						{/if}
					</main>
					{#if validation.open}<ValidationPanel />{/if}
				</div>
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
	<QuickFind />
	<ShortcutSheet />
	<UnsavedPrompt />
	<ConfirmDeleteDialog />
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
		font-size: var(--text-small);
		background: var(--chrome-bg);
	}
	.classic-column.left {
		width: 200px;
		border-inline-end: 1px solid var(--chrome-border);
	}
	.classic-column.right {
		width: 280px;
		border-inline-start: 1px solid var(--chrome-border);
	}
	/* The footer sits on the paper, which is white in every theme, so its text and plate are paper-side. */
	.footer {
		position: absolute;
		bottom: var(--space-3);
		inset-inline-start: var(--space-4);
		z-index: var(--z-footer);
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: 2px 6px;
		font-size: var(--text-small);
		color: var(--paper-muted);
		background: color-mix(in srgb, var(--paper-bg) 88%, transparent);
		border-radius: var(--control-radius);
	}
	/* Chrome over the paper, the same plate as the link hint (board 10). */
	.narration {
		position: absolute;
		inset-inline-end: var(--space-3);
		bottom: var(--space-3);
		inset-inline-start: var(--space-3);
		z-index: var(--z-footer);
		display: flex;
		gap: 10px;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-small);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--control-radius);
		box-shadow: var(--shadow-float);
		pointer-events: none;
	}
	.narration-tag {
		flex-shrink: 0;
		padding: 1px 6px;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: color-mix(in srgb, var(--accent) 12%, var(--chrome-surface));
		border-radius: 4px;
	}
	/* The drop layer: the skip link, when focused, must clear everything the page can show. */
	.skip-link {
		position: absolute;
		top: -100px;
		inset-inline-start: var(--space-2);
		z-index: var(--z-drop);
		padding: 6px 10px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--control-radius);
	}
	.skip-link:focus-visible {
		top: var(--space-2);
	}
	.footer > span {
		pointer-events: none;
	}
	.file-name {
		height: var(--control-min);
		padding: 0 var(--space-1);
		color: var(--paper-muted);
		border-radius: var(--control-radius);
	}
	/* A count of warnings: amber is the warning colour (ui.md), on the paper side of the plate. */
	.warnings {
		text-decoration: underline wavy var(--warning);
		text-underline-offset: 3px;
	}
	.file-name:hover {
		color: var(--paper-ink);
		background: var(--paper-grid);
	}
	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-drop);
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
		border-radius: var(--radius-menu);
	}
	.drop-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: var(--space-6) var(--space-10);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-dialog);
	}
	.drop-card svg {
		box-sizing: content-box;
		padding: var(--space-2);
		color: var(--on-accent);
		background: var(--accent-fill);
		border-radius: var(--control-radius);
	}
	.drop-title {
		font-size: var(--text-lead);
		font-weight: 600;
	}
	.drop-hint {
		font-size: var(--text-small);
		color: var(--chrome-muted);
	}
</style>
