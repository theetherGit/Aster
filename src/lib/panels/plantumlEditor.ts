/**
 * The Text view's editor (M2.4 prompt: CodeMirror 6, approved for the slice): PlantUML coloured by
 * Shiki through mark decorations, parse errors as inline diagnostics, and ⌘F search. Only the
 * platform's own editing keys plus ⌘F (keyboard.md "Find in text view") are bound: no history,
 * so ⌘Z reaches the app's undo (one step per parse); no Tab binding, so Tab leaves the editor.
 * Loaded with the Text tab, never with the app.
 */
import { Annotation, Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	keymap,
	lineNumbers,
	type DecorationSet,
	type ViewUpdate
} from '@codemirror/view';
import { insertNewline, standardKeymap } from '@codemirror/commands';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { closeSearchPanel, openSearchPanel, search } from '@codemirror/search';
import { highlight, type TokenKind } from '#lib/puml/highlight.ts';

export interface EditorOptions {
	label: string;
	/** Ids of the elements that describe the editor (status line, error list). */
	describedBy: string;
	/** CodeMirror's own words (search panel, lint), translated. */
	phrases: Record<string, string>;
}
export interface PumlEditor {
	/** Replace the text from outside (a model change); the caret and scroll stay where they were. */
	set(text: string): void;
	diagnose(errors: { line: number; message: string }[]): void;
	configure(options: EditorOptions): void;
	goTo(line: number): void;
	focus(): void;
	destroy(): void;
}

/** Marks a change that came from the model, so it is not read back as typing. */
const fromModel = Annotation.define<boolean>();

const MARKS = new Map<TokenKind, Decoration>();
const mark = (kind: TokenKind) => {
	let m = MARKS.get(kind);
	if (!m) MARKS.set(kind, (m = Decoration.mark({ class: `tk-${kind}` })));
	return m;
};

// ponytail: re-colours the whole text on every change (about 10 ms for a 4,600-line diagram);
// colour only the visible ranges, from a cached grammar state per line, if diagrams outgrow that.
function colour(view: EditorView): DecorationSet {
	const b = new RangeSetBuilder<Decoration>();
	let at = 0;
	for (const line of highlight(view.state.doc.toString())) {
		for (const t of line) {
			if (t.kind !== 'text' && t.text) b.add(at, at + t.text.length, mark(t.kind));
			at += t.text.length;
		}
		at += 1; // the line break
	}
	return b.finish();
}
const colours = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = colour(view);
		}
		update(u: ViewUpdate) {
			if (u.docChanged) this.decorations = colour(u.view);
		}
	},
	{ decorations: (v) => v.decorations }
);

// Every colour is a token; the token kinds take design.md's two colours beside the text's own.
const theme = EditorView.theme({
	'&': {
		height: '100%',
		color: 'var(--chrome-text)',
		backgroundColor: 'var(--chrome-bg)',
		fontSize: 'var(--text-small)'
	},
	'&.cm-focused': { outline: '2px dashed var(--accent)', outlineOffset: '-2px' },
	'.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '20px' },
	'.cm-content': { padding: 'var(--space-2) 0', caretColor: 'var(--chrome-text)' },
	'.cm-content ::selection': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)'
	},
	'.cm-gutters': {
		color: 'var(--chrome-muted)',
		backgroundColor: 'var(--chrome-bg)',
		border: 'none'
	},
	'.tk-keyword, .tk-arrow, .tk-type': { color: 'var(--accent-text)' },
	'.tk-comment, .tk-directive, .tk-stereotype, .tk-modifier': { color: 'var(--chrome-muted)' },
	// Parse errors: a wavy underline and a dot in the gutter, both in the danger token.
	'.cm-lintRange-error': {
		backgroundImage: 'none',
		textDecoration: 'underline wavy var(--danger)',
		textUnderlineOffset: '3px'
	},
	'.cm-lint-marker-error': {
		content: 'none',
		width: 'var(--space-2)',
		height: 'var(--space-2)',
		margin: '6px var(--space-1) 0',
		borderRadius: 'var(--radius-pill)',
		backgroundColor: 'var(--danger)'
	},
	'.cm-tooltip': {
		color: 'var(--chrome-text)',
		backgroundColor: 'var(--chrome-surface)',
		border: '1px solid var(--chrome-border)',
		borderRadius: 'var(--control-radius)',
		boxShadow: 'var(--shadow-float)'
	},
	// The search panel: fields and buttons at least 24 px (CLAUDE.md rule 4), on the chrome.
	'.cm-panels': {
		color: 'var(--chrome-text)',
		backgroundColor: 'var(--chrome-surface)',
		borderColor: 'var(--chrome-border)'
	},
	'.cm-search': { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-1)' },
	'.cm-panel.cm-search': { fontSize: 'var(--text-small)' },
	'.cm-search label': {
		display: 'inline-flex',
		alignItems: 'center',
		minHeight: 'var(--control-min)',
		fontSize: 'inherit'
	},
	// Matches in the accent, not CodeMirror's yellow and orange.
	'.cm-searchMatch': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
		outline: '1px solid color-mix(in srgb, var(--accent) 60%, transparent)'
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 40%, transparent)'
	},
	'.cm-search input[type=checkbox]': {
		width: 'var(--space-4)',
		height: 'var(--space-4)',
		margin: '0 var(--space-1)'
	},
	'.cm-textfield, .cm-button': {
		boxSizing: 'border-box',
		minHeight: 'var(--control-min)',
		font: 'inherit',
		color: 'var(--chrome-text)',
		border: '1px solid var(--control-border)',
		borderRadius: 'var(--control-radius)'
	},
	'.cm-textfield': { backgroundColor: 'var(--chrome-bg)' },
	'.cm-button': { backgroundColor: 'var(--chrome-surface)', backgroundImage: 'none' },
	'.cm-panel.cm-search [name=close]': {
		minWidth: 'var(--control-min)',
		minHeight: 'var(--control-min)',
		color: 'var(--chrome-muted)'
	}
});

const attributes = (o: EditorOptions) =>
	EditorView.contentAttributes.of({
		id: 'text-view',
		'aria-label': o.label,
		'aria-describedby': o.describedBy,
		spellcheck: 'false',
		autocorrect: 'off',
		autocapitalize: 'off'
	});

export function createPumlEditor(
	parent: HTMLElement,
	options: EditorOptions,
	on: { input: (text: string) => void; caret: (line: number, col: number) => void }
): PumlEditor {
	const settings = new Compartment();
	const configured = (o: EditorOptions) => [attributes(o), EditorState.phrases.of(o.phrases)];
	const view = new EditorView({
		parent,
		state: EditorState.create({
			extensions: [
				lineNumbers(),
				lintGutter(),
				search({ top: true }),
				// Enter as in a text area (no auto-indent), ⌘F and Esc for search, then the platform's own
				// editing keys.
				keymap.of([
					{ key: 'Enter', run: insertNewline },
					{ key: 'Mod-f', run: openSearchPanel, scope: 'editor search-panel' },
					// keyboard.md's progressive Esc: the search panel closes first.
					{ key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' },
					...standardKeymap
				]),
				colours,
				theme,
				settings.of(configured(options)),
				EditorView.updateListener.of((u) => {
					if (u.docChanged && !u.transactions.some((tr) => tr.annotation(fromModel)))
						on.input(u.state.doc.toString());
					if (u.docChanged || u.selectionSet) {
						const head = u.state.selection.main.head;
						const line = u.state.doc.lineAt(head);
						on.caret(line.number, head - line.from + 1);
					}
				})
			]
		})
	});

	return {
		set(text) {
			const now = view.state.doc.toString();
			if (now === text) return;
			// Replace only what differs, so the caret and scroll map through the change.
			let a = 0;
			while (a < now.length && a < text.length && now[a] === text[a]) a++;
			let b = 0;
			while (b < now.length - a && b < text.length - a && now.at(-1 - b) === text.at(-1 - b)) b++;
			view.dispatch({
				changes: { from: a, to: now.length - b, insert: text.slice(a, text.length - b) },
				annotations: fromModel.of(true)
			});
		},
		diagnose(errors) {
			const doc = view.state.doc;
			view.dispatch(
				setDiagnostics(
					view.state,
					errors.map((e) => {
						const line = doc.line(Math.max(1, Math.min(e.line, doc.lines)));
						return { from: line.from, to: line.to, severity: 'error', message: e.message };
					})
				)
			);
		},
		configure(o) {
			view.dispatch({ effects: settings.reconfigure(configured(o)) });
		},
		goTo(line) {
			const l = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
			view.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
			view.focus();
		},
		focus: () => view.focus(),
		destroy: () => view.destroy()
	};
}
