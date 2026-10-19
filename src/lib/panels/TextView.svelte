<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { freePosition } from '#lib/canvas/place.ts';
	import { batch } from '#lib/commands/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { parsePuml, type PError } from '#lib/puml/parse.ts';
	import { printDiagram } from '#lib/puml/print.ts';
	import { highlight } from '#lib/puml/highlight.ts';
	import { exportPuml, pickPumlText } from '#lib/persist/files.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import { planSync } from '#lib/puml/sync.ts';
	import { announce } from '#lib/stores/live.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';

	// features.md M2, Text view (board 09): the open diagram as PlantUML, both ways. Text edits
	// parse 250 ms after the last key and apply as one command; a change made elsewhere (canvas,
	// Outline, inspector, undo) prints the text again. A plain <textarea> until the CodeMirror
	// editor is allowed in (DECISIONS.md): line numbers, status line and errors are drawn here.
	let area: HTMLTextAreaElement;
	let gutter: HTMLDivElement;
	let value = $state('');
	let errors: PError[] = $state([]);
	let pending = $state(false);
	let caret = $state({ line: 1, col: 1 });
	/** Lines the last parse kept as typed (comments, skinparam): printed back so nothing is lost. */
	let kept: string[] = [];
	/** The model version and diagram our own last parse left: anything else came from elsewhere. */
	let ours = '';
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Model → text: on open, on a diagram switch, and when the model changes from elsewhere.
	$effect(() => {
		const key = `${projectStore.version}/${projectStore.activeDiagramId}`;
		const diagram = projectStore.diagram;
		if (key === ours) return;
		untrack(() => {
			if (pending) return; // the text being typed wins; it applies in a moment
			// Setting a textarea's value sends the caret to the end: keep where the reader was.
			const at = area ? area.selectionStart : 0;
			const top = area ? area.scrollTop : 0;
			value = printDiagram(projectStore.project, diagram, kept);
			errors = [];
			tick().then(() => {
				if (!area) return;
				area.setSelectionRange(Math.min(at, value.length), Math.min(at, value.length));
				area.scrollTop = top;
			});
		});
	});

	function oninput() {
		pending = true;
		clearTimeout(timer);
		timer = setTimeout(apply, 250);
	}
	/** Text → model: one parse, one command; with errors, nothing changes until they are fixed. */
	function apply() {
		pending = false;
		const doc = parsePuml(value);
		const had = errors.length;
		errors = doc.errors;
		if (doc.errors.length) {
			if (doc.errors.length !== had) announce(t('live.textErrors', { count: doc.errors.length }));
			return;
		}
		kept = doc.kept;
		const taken = [...canvasApi.rects().values()];
		const plan = planSync(projectStore.project, projectStore.activeDiagramId, doc, {
			place: () => {
				const at = freePosition({ x: 40, y: 40 }, taken);
				taken.push({ ...at, w: 160, h: 80 });
				return at;
			}
		});
		if (plan) projectStore.run(batch, plan);
		ours = `${projectStore.version}/${projectStore.activeDiagramId}`;
	}

	function track() {
		const before = area.value.slice(0, area.selectionStart);
		caret = { line: before.split('\n').length, col: before.length - before.lastIndexOf('\n') };
	}
	function goTo(line: number) {
		const at =
			value
				.split('\n')
				.slice(0, line - 1)
				.join('\n').length + (line > 1 ? 1 : 0);
		area.focus();
		area.setSelectionRange(at, at);
		track();
	}
	const lineCount = $derived(value.split('\n').length);
	let layer: HTMLDivElement;
	const coloured = $derived(value.split('\n').map(highlight));

	/** Import here: a .puml file's text replaces this diagram's, applied at once (one undo step). */
	async function importHere() {
		const text = await pickPumlText();
		if (text === null) return;
		value = text;
		clearTimeout(timer);
		apply();
		area?.focus();
	}
	const errorText = (e: PError) =>
		t(`text.error.${e.message}` as MessageKey, { line: e.line, name: e.name ?? '' });
	const count = $derived(
		errors.length === 1 ? t('text.errorsOne') : t('text.errors', { count: errors.length })
	);
</script>

<div class="flex flex-col">
	<!-- Owner's report: import and export live where the text does, as well as in the menus. -->
	<div class="flex items-center gap-1 ps-4 pe-2 pt-2 pb-1">
		<span class="me-auto text-(length:--text-caption) text-chrome-muted">{t('text.dialect')}</span>
		<Button variant="ghost" size="sm" onclick={importHere}>{t('text.import')}</Button>
		<Button variant="ghost" size="sm" onclick={() => exportPuml()}>{t('text.export')}</Button>
	</div>
	<div
		class="flex h-[calc(100dvh-220px)] min-h-60 border-y border-chrome-border bg-chrome-bg font-mono text-[12px] leading-5"
	>
		<div
			bind:this={gutter}
			class="w-10 shrink-0 overflow-hidden py-2 pe-2 text-end text-chrome-muted select-none"
			aria-hidden="true"
		>
			{#each { length: lineCount }, i (i)}<div>{i + 1}</div>{/each}
		</div>
		<!-- Owner's request: colour. The coloured copy sits behind a text area whose own text is
		     transparent, so typing, selection and screen readers stay the native field's. In forced
		     colours the field shows its own text and the copy hides. -->
		<div class="relative min-w-0 flex-1">
			<div
				bind:this={layer}
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 overflow-hidden py-2 pe-2 font-mono text-[12px] leading-5 whitespace-pre text-chrome-text forced-colors:hidden"
			>
				{#each coloured as line, i (i)}<div class="h-5">
						{#each line as tk, j (j)}<span class="tk-{tk.kind}">{tk.text}</span>{/each}
					</div>{/each}
			</div>
			<textarea
				id="text-view"
				bind:this={area}
				bind:value
				class="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-2 pe-2 whitespace-pre text-transparent caret-chrome-text selection:bg-accent/25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed forced-colors:text-[CanvasText]"
				dir="ltr"
				wrap="off"
				spellcheck="false"
				autocomplete="off"
				aria-label={t('text.label')}
				aria-describedby="text-status{errors.length ? ' text-errors' : ''}"
				{oninput}
				onkeyup={track}
				onclick={track}
				onselect={track}
				onscroll={() => {
					gutter.scrollTop = area.scrollTop;
					layer.scrollTop = area.scrollTop;
					layer.scrollLeft = area.scrollLeft;
				}}></textarea>
		</div>
	</div>
	{#if errors.length}
		<ul id="text-errors" aria-label={t('text.errorList')} class="px-2 pt-2">
			{#each errors as e (e.line + e.message)}
				<li>
					<button
						type="button"
						class="flex min-h-(--control-min) w-full items-center rounded-control px-2 text-start text-(length:--text-small) text-chrome-text hover:bg-chrome-bg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-dashed"
						onclick={() => goTo(e.line)}>{errorText(e)}</button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<!-- Board 09's status line: state and error count on the left, the caret on the right. -->
	<div
		id="text-status"
		data-testid="text-status"
		class="flex items-center gap-2 px-4 py-2 text-(length:--text-small) text-chrome-muted"
	>
		<span
			class="size-2 rounded-full {errors.length || pending ? 'bg-warning' : 'bg-ok'}"
			aria-hidden="true"
		></span>
		<span
			>{pending ? t('text.pending') : errors.length ? t('text.notApplied') : t('text.inSync')}</span
		>
		<span aria-hidden="true">·</span>
		<span>{count}</span>
		<span class="ms-auto">{t('text.caret', caret)}</span>
	</div>
</div>

<style>
	/* The two colours hold 4.5:1 on the chrome in every theme (tokens.css, contrast test). */
	.tk-keyword,
	.tk-arrow {
		color: var(--accent-text);
	}
	.tk-comment,
	.tk-directive {
		color: var(--chrome-muted);
	}
</style>
