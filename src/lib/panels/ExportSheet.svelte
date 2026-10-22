<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import {
		DEFAULT_EXPORT,
		copyDiagramAsPng,
		copyExportText,
		downloadExport,
		exportText,
		fileName,
		isImage,
		isText,
		render,
		tabOf,
		type ExportFormat,
		type ExportOptions,
		type ExportTab
	} from '#lib/export/actions.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Checkbox from '#lib/ui/atoms/Checkbox.svelte';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';
	import Segment from '#lib/ui/atoms/Segment.svelte';
	import Tab from '#lib/ui/atoms/Tab.svelte';

	// Board 06, with the M3.4 prompt's tabs: one sheet, the formats grouped by what they are for.
	// Options are remembered for the session (owner's #29: per project, with persistence).
	let options: ExportOptions = $state({ ...DEFAULT_EXPORT });
	const tab = $derived(tabOf(options.format));
	/** The format each tab had last, so switching tabs and back keeps the choice. */
	const last: Record<ExportTab, ExportFormat> = { image: 'png', text: 'mermaid', project: 'mdj' };
	// The copy result, shown inline (the live region announces it too); never a native alert.
	let copyStatus: 'copied' | 'failed' | null = $state(null);
	let busy = $state(false);
	// Focus goes back to whatever opened the sheet (the Export button, the palette's opener).
	let restore: HTMLElement | null = null;
	$effect(() => {
		if (ui.exportOpen) restore = document.activeElement as HTMLElement | null;
	});

	const selected = $derived(
		selection.list.filter((id) => projectStore.project.elements.get(id)?.kind === 'classifier')
			.length
	);
	// Dimensions and a size estimate for the file row; the SVG itself is cheap to build.
	let preview: { width: number; height: number; bytes: number } | null = $state(null);
	$effect(() => {
		if (!ui.exportOpen) return;
		void projectStore.version;
		const o = $state.snapshot(options);
		let live = true;
		if (!isImage(o.format)) {
			preview = null;
			return;
		}
		render(o).then((r) => {
			if (!live) return;
			const px = r.width * r.height * o.scale * o.scale;
			// ponytail: ~0.17 B/px for a PNG of line art, measured on the boards; exact on download
			const bytes = o.format === 'svg' ? r.svg.length : Math.round(px * 0.17);
			preview = { width: r.width * o.scale, height: r.height * o.scale, bytes };
		});
		return () => {
			live = false;
		};
	});
	/** The Text tab shows what it will write. */
	const text = $derived.by(() => {
		void projectStore.version;
		return ui.exportOpen && isText(options.format) ? exportText(options.format) : '';
	});
	const size = (b: number) =>
		b < 1024 * 1024
			? t('export.kb', { n: Math.max(1, Math.round(b / 1024)) })
			: t('export.mb', { n: (b / 1024 / 1024).toFixed(1) });
	const fmt = (n: number) => n.toLocaleString();
	// SVG has no scale: say so where the disabled control is.
	const reason = $derived(options.format === 'svg' ? t('export.scalePngOnly') : null);
	const FORMATS: Record<ExportTab, { value: string; label: string }[]> = {
		image: [
			{ value: 'png', label: t('export.fmt.png') },
			{ value: 'svg', label: t('export.fmt.svg') }
		],
		text: [
			{ value: 'mermaid', label: t('export.fmt.mermaid') },
			{ value: 'puml', label: t('export.fmt.puml') }
		],
		project: [
			{ value: 'mdj', label: t('export.fmt.mdj') },
			{ value: 'aster', label: t('export.fmt.aster') }
		]
	};
	const SCALES = [
		{ value: '1', label: '1×' },
		{ value: '2', label: '2×' }
	];
	const TABS: ExportTab[] = ['image', 'text', 'project'];

	function choose(f: ExportFormat) {
		options.format = f;
		last[tabOf(f)] = f;
		copyStatus = null;
	}
	function close() {
		ui.exportOpen = false;
		copyStatus = null;
		if (restore && document.contains(restore)) restore.focus();
		else canvasFocus.focus();
	}
	async function run(action: (o: ExportOptions) => Promise<unknown>) {
		busy = true;
		try {
			await action($state.snapshot(options));
		} finally {
			busy = false;
		}
	}
	async function copy() {
		const o = $state.snapshot(options);
		copyStatus = (isText(o.format) ? await copyExportText(o.format) : await copyDiagramAsPng(o))
			? 'copied'
			: 'failed';
	}
	// Bits' first-tabbable pass can run before the tabs settle and leave focus on the opener;
	// focus the open tab once it is ready.
	function focusTab(e: Event) {
		e.preventDefault();
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				document.querySelector<HTMLElement>('[data-export-tabs] [data-state="active"]')?.focus()
			)
		);
	}
</script>

{#snippet formats(of: ExportTab)}
	<Segment
		items={FORMATS[of]}
		label={t('export.format')}
		value={options.format}
		onchange={(v) => choose(v as ExportFormat)}
	/>
{/snippet}

<DialogFrame
	title={t('export.title')}
	width={520}
	bind:open={() => ui.exportOpen, (open) => !open && close()}
	onOpenAutoFocus={focusTab}
>
	<Tabs.Root value={tab} onValueChange={(v) => choose(last[v as ExportTab])}>
		<Tabs.List
			class="mt-3 flex border-b border-chrome-border"
			aria-label={t('export.tabs')}
			data-export-tabs
		>
			{#each TABS as k (k)}
				<Tab value={k}>{t(`export.tab.${k}`)}</Tab>
			{/each}
		</Tabs.List>

		<Tabs.Content value="image">
			<div class="mt-4 flex flex-wrap items-start gap-3">
				{@render formats('image')}
				<Segment
					items={SCALES}
					label={t('export.scale')}
					value={String(options.scale)}
					onchange={(v) => (options.scale = Number(v) as ExportOptions['scale'])}
					disabled={options.format !== 'png'}
					aria-description={reason ?? undefined}
				/>
			</div>
			{#if reason}
				<p class="mt-2 text-(length:--text-small) text-chrome-muted" data-testid="export-reason">
					{reason}
				</p>
			{/if}
			<fieldset class="mt-4 flex flex-col gap-2">
				<legend class="sr-only">{t('export.background')}</legend>
				<label class="flex items-center gap-2"
					><input type="radio" name="bg" value="white" bind:group={options.background} />{t(
						'export.white'
					)}</label
				>
				<label class="flex items-center gap-2"
					><input type="radio" name="bg" value="transparent" bind:group={options.background} />{t(
						'export.transparent'
					)}</label
				>
				<Checkbox
					label={t('export.selectionOnly')}
					bind:checked={options.selectionOnly}
					disabled={selected === 0}
				>
					{#snippet trailing()}
						<span class="text-chrome-muted">{t('export.selectionCount', { count: selected })}</span>
					{/snippet}
				</Checkbox>
			</fieldset>
		</Tabs.Content>

		<Tabs.Content value="text">
			<div class="mt-4">{@render formats('text')}</div>
			<p class="mt-2 text-(length:--text-small) text-chrome-muted">
				{t(`export.hint.${options.format === 'puml' ? 'puml' : 'mermaid'}`)}
			</p>
			<!-- A scrolling region is in the Tab order so a keyboard can scroll it (axe: scrollable-region-focusable). -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre
				class="mt-3 max-h-56 overflow-auto rounded-control border border-chrome-border bg-chrome-bg p-3 font-mono text-(length:--text-small) leading-normal"
				tabindex="0"
				aria-label={t('export.preview')}
				data-testid="export-text">{text}</pre>
		</Tabs.Content>

		<Tabs.Content value="project">
			<div class="mt-4">{@render formats('project')}</div>
			<p class="mt-2 text-(length:--text-small) text-chrome-muted">
				{t(`export.hint.${options.format === 'aster' ? 'aster' : 'mdj'}`)}
			</p>
		</Tabs.Content>
	</Tabs.Root>

	<div
		class="mt-4 flex items-center justify-between gap-3 rounded-control border border-chrome-border bg-chrome-bg px-3 py-2 text-(length:--text-small)"
	>
		<span class="truncate" data-testid="export-name" title={fileName(options)}
			>{fileName(options)}</span
		>
		{#if preview && isImage(options.format)}
			<span class="shrink-0 text-chrome-muted"
				>{t('export.size', {
					width: fmt(preview.width),
					height: fmt(preview.height),
					size: size(preview.bytes)
				})}</span
			>
		{:else if text}
			<span class="shrink-0 text-chrome-muted"
				>{t('export.textSize', {
					lines: fmt(text.split('\n').length - 1),
					size: size(new Blob([text]).size)
				})}</span
			>
		{/if}
	</div>

	{#snippet actions()}
		{#if tab !== 'project'}
			<Button disabled={busy} onclick={() => run(copy)}
				>{tab === 'text' ? t('export.copyText') : t('export.copy')}</Button
			>
		{/if}
		{#if copyStatus}
			<span
				class="text-(length:--text-small)"
				class:text-chrome-muted={copyStatus === 'copied'}
				class:text-danger={copyStatus === 'failed'}
				data-testid="export-copy-status"
				>{copyStatus === 'copied'
					? t('export.copied')
					: tab === 'text'
						? t('export.copyTextFailed')
						: t('export.copyFailed')}</span
			>
		{/if}
		<span class="flex-1"></span>
		<Button variant="ghost" onclick={close}>{t('export.cancel')}</Button>
		<Button variant="primary" disabled={busy} onclick={() => run(downloadExport)}
			>{t('export.download')}</Button
		>
	{/snippet}
</DialogFrame>
