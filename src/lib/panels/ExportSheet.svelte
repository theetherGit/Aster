<script lang="ts">
	import { canvasFocus } from '#lib/canvas/focus.ts';
	import {
		DEFAULT_EXPORT,
		copyDiagramAsPng,
		downloadExport,
		fileName,
		isImage,
		render,
		type ExportOptions
	} from '#lib/export/actions.ts';
	import { t } from '#lib/i18n/index.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import Checkbox from '#lib/ui/atoms/Checkbox.svelte';
	import DialogFrame from '#lib/ui/atoms/DialogFrame.svelte';
	import Segment from '#lib/ui/atoms/Segment.svelte';

	// Board 06. Options are remembered for the session (owner's #29: per project, with persistence).
	let options: ExportOptions = $state({ ...DEFAULT_EXPORT });
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
	const size = (b: number) =>
		b < 1024 * 1024
			? t('export.kb', { n: Math.round(b / 1024) })
			: t('export.mb', { n: (b / 1024 / 1024).toFixed(1) });
	const fmt = (n: number) => n.toLocaleString();
	// Why the image options are off: file formats take none, SVG has no scale.
	const reason = $derived(
		!isImage(options.format)
			? t('export.imageOnly')
			: options.format === 'svg'
				? t('export.scalePngOnly')
				: null
	);
	const FORMATS = [
		{ value: 'png', label: t('export.fmt.png') },
		{ value: 'svg', label: t('export.fmt.svg') },
		{ value: 'mdj', label: t('export.fmt.mdj') },
		{ value: 'aster', label: t('export.fmt.aster') }
	];
	const SCALES = [
		{ value: '1', label: '1×' },
		{ value: '2', label: '2×' }
	];

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
	// The format segment's roving tabindex settles a frame after mount, and Bits' own first-tabbable
	// pass can run before it and leave focus on the opener; focus the chosen format once it is ready.
	function focusFormat(e: Event) {
		e.preventDefault();
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				document
					.querySelector<HTMLElement>('[data-export-format] [role="radio"][aria-checked="true"]')
					?.focus()
			)
		);
	}
</script>

<DialogFrame
	title={t('export.title')}
	bind:open={() => ui.exportOpen, (open) => !open && close()}
	onOpenAutoFocus={focusFormat}
>
	<div class="mt-4 flex flex-wrap items-start gap-3" data-export-format>
		<Segment
			items={FORMATS}
			label={t('export.format')}
			value={options.format}
			onchange={(v) => (options.format = v as ExportOptions['format'])}
		/>
		<Segment
			items={SCALES}
			label={t('export.scale')}
			value={String(options.scale)}
			onchange={(v) => (options.scale = Number(v) as ExportOptions['scale'])}
			disabled={options.format !== 'png'}
			aria-description={options.format !== 'png' ? t('export.scalePngOnly') : undefined}
		/>
	</div>
	{#if reason}
		<p class="mt-2 text-(length:--text-small) text-chrome-muted" data-testid="export-reason">
			{reason}
		</p>
	{/if}

	<fieldset class="mt-4 flex flex-col gap-2" disabled={!isImage(options.format)}>
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
		{/if}
	</div>

	{#snippet actions()}
		<Button
			disabled={busy || !isImage(options.format)}
			onclick={() =>
				run(async (o) => {
					copyStatus = (await copyDiagramAsPng(o)) ? 'copied' : 'failed';
				})}>{t('export.copy')}</Button
		>
		{#if copyStatus}
			<span
				class="text-(length:--text-small)"
				class:text-chrome-muted={copyStatus === 'copied'}
				class:text-danger={copyStatus === 'failed'}
				data-testid="export-copy-status"
				>{copyStatus === 'copied' ? t('export.copied') : t('export.copyFailed')}</span
			>
		{/if}
		<span class="flex-1"></span>
		<Button variant="ghost" onclick={close}>{t('export.cancel')}</Button>
		<Button variant="primary" disabled={busy} onclick={() => run(downloadExport)}
			>{t('export.download')}</Button
		>
	{/snippet}
</DialogFrame>
