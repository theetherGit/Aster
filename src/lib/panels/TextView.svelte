<script lang="ts">
	import { untrack } from 'svelte';
	import { canvasApi } from '#lib/canvas/api.ts';
	import { freePosition } from '#lib/canvas/place.ts';
	import { batch } from '#lib/commands/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import { parsePuml, type PError } from '#lib/puml/parse.ts';
	import { printDiagram } from '#lib/puml/print.ts';
	import type { PumlEditor } from './plantumlEditor.ts';
	import { exportPuml, pickPumlText } from '#lib/persist/files.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import { planSync } from '#lib/puml/sync.ts';
	import { announce } from '#lib/stores/live.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';

	// features.md M2, Text view (board 09): the open diagram as PlantUML, both ways. Text edits
	// parse 250 ms after the last key and apply as one command; a change made elsewhere (canvas,
	// Outline, inspector, undo) prints the text again. The editor is CodeMirror (plantumlEditor.ts),
	// loaded with the tab; the status line and the error list are drawn here.
	let host: HTMLDivElement;
	let editor = $state.raw<PumlEditor | null>(null);
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
			value = printDiagram(projectStore.project, diagram, kept);
			errors = [];
			editor?.set(value); // only what differs is replaced, so the caret stays put
			editor?.diagnose([]);
		});
	});

	function oninput(text: string) {
		value = text;
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
		editor?.diagnose(doc.errors.map((e) => ({ line: e.line, message: errorText(e) })));
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

	// CodeMirror and Shiki load with the tab, not with the app.
	$effect(() => {
		let gone = false;
		let made: PumlEditor | undefined;
		import('./plantumlEditor.ts').then((m) => {
			if (gone) return;
			made = m.createPumlEditor(host, untrack(options), {
				input: oninput,
				caret: (line, col) => (caret = { line, col })
			});
			made.set(untrack(() => value));
			editor = made;
		});
		return () => {
			gone = true;
			made?.destroy();
			editor = null;
		};
	});
	// The label, the description and CodeMirror's own words follow the locale and the errors.
	const options = () => ({
		label: t('text.label'),
		describedBy: `text-status${errors.length ? ' text-errors' : ''}`,
		phrases: {
			Find: t('text.cm.find'),
			Replace: t('text.cm.replace'),
			next: t('text.cm.next'),
			previous: t('text.cm.previous'),
			all: t('text.cm.all'),
			'match case': t('text.cm.matchCase'),
			'by word': t('text.cm.byWord'),
			regexp: t('text.cm.regexp'),
			replace: t('text.cm.replaceOne'),
			'replace all': t('text.cm.replaceAll'),
			close: t('text.cm.close'),
			'current match': t('text.cm.currentMatch'),
			'on line': t('text.cm.onLine'),
			'replaced $ matches': t('text.cm.replacedMany'),
			'replaced match on line $': t('text.cm.replacedOne'),
			'Go to line': t('text.cm.goToLine'),
			go: t('text.cm.go'),
			Diagnostics: t('text.cm.diagnostics'),
			'No diagnostics': t('text.cm.noDiagnostics'),
			'Control character': t('text.cm.controlCharacter')
		}
	});
	$effect(() => {
		const o = options();
		untrack(() => editor)?.configure(o);
	});
	// The palette's "Text view" asks for focus; the editor takes it once it exists.
	$effect(() => {
		if (ui.focusText && editor) {
			editor.focus();
			ui.focusText = false;
		}
	});
	const goTo = (line: number) => editor?.goTo(line);

	/** Import here: a .puml file's text replaces this diagram's, applied at once (one undo step). */
	async function importHere() {
		const text = await pickPumlText();
		if (text === null) return;
		value = text;
		editor?.set(text);
		clearTimeout(timer);
		apply();
		editor?.focus();
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
	<!-- The editor fills this box; until CodeMirror has loaded it is empty. -->
	<div
		bind:this={host}
		class="h-[calc(100dvh-220px)] min-h-60 border-y border-chrome-border bg-chrome-bg"
	></div>
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
