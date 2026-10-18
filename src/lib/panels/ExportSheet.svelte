<script lang="ts">
	import { Dialog, ToggleGroup } from 'bits-ui';
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

	// Board 06. Options are remembered for the session (owner's #29: per project, with persistence).
	let options: ExportOptions = $state({ ...DEFAULT_EXPORT });
	let copied = $state(false);
	let busy = $state(false);

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
		b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
	const fmt = (n: number) => n.toLocaleString();

	function close() {
		ui.exportOpen = false;
		canvasFocus.focus();
	}
	async function run(action: (o: ExportOptions) => Promise<unknown>) {
		busy = true;
		try {
			await action($state.snapshot(options));
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root
	open={ui.exportOpen}
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[460px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-chrome-border bg-chrome-surface p-5 text-chrome-text shadow-2xl"
			aria-describedby={undefined}
		>
			<Dialog.Title class="text-[16px] font-semibold">{t('export.title')}</Dialog.Title>

			<div class="mt-4 grid grid-cols-2 gap-3">
				<ToggleGroup.Root
					type="single"
					value={options.format}
					onValueChange={(v: string) => v && (options.format = v as ExportOptions['format'])}
					aria-label={t('export.format')}
					class="segment"
				>
					<ToggleGroup.Item value="png" class="segment-item">PNG</ToggleGroup.Item>
					<ToggleGroup.Item value="svg" class="segment-item">SVG</ToggleGroup.Item>
					<ToggleGroup.Item value="mdj" class="segment-item">.mdj</ToggleGroup.Item>
					<ToggleGroup.Item value="aster" class="segment-item">.aster</ToggleGroup.Item>
				</ToggleGroup.Root>
				<ToggleGroup.Root
					type="single"
					value={String(options.scale)}
					onValueChange={(v: string) => v && (options.scale = Number(v) as ExportOptions['scale'])}
					aria-label={t('export.scale')}
					class="segment"
					disabled={options.format !== 'png'}
				>
					<ToggleGroup.Item value="1" class="segment-item">1×</ToggleGroup.Item>
					<ToggleGroup.Item value="2" class="segment-item">2×</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<fieldset class="mt-4 flex flex-col gap-2" disabled={!isImage(options.format)}>
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
				<label class="mt-1 flex items-center gap-2"
					><input
						type="checkbox"
						bind:checked={options.selectionOnly}
						disabled={selected === 0}
					/>{t('export.selectionOnly')}
					<span class="text-chrome-muted">{t('export.selectionCount', { count: selected })}</span
					></label
				>
			</fieldset>

			<div
				class="mt-4 flex items-center justify-between gap-3 rounded-control border border-chrome-border bg-chrome-bg px-3 py-2 text-[12px]"
			>
				<span class="truncate font-mono" data-testid="export-name">{fileName(options)}</span>
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

			<div class="mt-4 flex items-center gap-2">
				<button
					type="button"
					class="h-8 rounded-control border border-chrome-border px-3 hover:bg-chrome-bg disabled:opacity-50"
					disabled={busy || !isImage(options.format)}
					onclick={() =>
						run(async (o) => {
							copied = await copyDiagramAsPng(o);
							setTimeout(() => (copied = false), 1500);
						})}>{copied ? t('export.copied') : t('export.copy')}</button
				>
				<span class="flex-1"></span>
				<Dialog.Close class="h-8 rounded-control px-3 text-chrome-muted hover:text-chrome-text"
					>{t('export.cancel')}</Dialog.Close
				>
				<button
					type="button"
					class="h-8 rounded-control bg-accent-fill px-3 font-medium text-on-accent disabled:opacity-50"
					disabled={busy}
					onclick={() => run(downloadExport)}>{t('export.download')}</button
				>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.segment) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		overflow: hidden;
		border: 1px solid var(--chrome-border);
		border-radius: var(--radius-control);
	}
	:global(.segment-item) {
		height: 32px;
		font-size: 13px;
		color: var(--chrome-text);
	}
	:global(.segment-item[data-state='on']) {
		background: var(--accent-fill);
		color: var(--on-accent);
	}
	:global(.segment[data-disabled]) {
		opacity: 0.5;
	}
</style>
