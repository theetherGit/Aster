/**
 * The app command registry (Day 6): every user-facing action once, with its label, shortcut,
 * group and `when`. The keyboard router, the palette (board 16) and the shortcut sheet (board 17)
 * all read this list; adding a command here is all it takes to appear in both.
 * Model commands stay in src/lib/commands; these call them.
 */
import { canvasApi } from '#lib/canvas/api.ts';
import { canvasFocus, explorerFocus, focusElement } from '#lib/canvas/focus.ts';
import { rightOf } from '#lib/canvas/place.ts';
import {
	copyFromMenu,
	deleteSelection,
	hasClipboard,
	nudgeSelection,
	pasteFrom,
	resizeSelection,
	setLineStyleForSelection,
	startEditing,
	stopEditing
} from '#lib/canvas/actions.ts';
import {
	addDiagram,
	batch,
	deleteDiagram,
	setDiagramDefaults,
	setNodeFlags
} from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import { copyDiagramAsPng } from '#lib/export/actions.ts';
import { t, type MessageKey } from '#lib/i18n/index.ts';
import { newId } from '#lib/model/ids.ts';
import type { ClassifierKind, DisplayFlags, Id, LineStyle } from '#lib/model/types.ts';
import {
	newProject,
	openFromPicker,
	saveFile,
	exportPuml,
	importPumlProject
} from '#lib/persist/files.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { validation } from '#lib/stores/validation.svelte.ts';
import { LOCALES, locale, setLocale } from '#lib/i18n/locale.svelte.ts';
import { ui, cycleTheme } from '#lib/stores/ui.svelte.ts';
import { parse, type Shortcut } from './shortcuts.ts';

export type Group = 'create' | 'edit' | 'select' | 'file' | 'view' | 'format' | 'display';
export type Context = 'global' | 'canvas';

export interface AppCommand {
	id: string;
	group: Group;
	label: () => string;
	keys: Shortcut[];
	/** 'global' works everywhere; 'canvas' only while the canvas has focus and nothing is edited. */
	context: Context;
	/** StarUML's own key for the same action (keyboard.md). */
	staruml?: boolean;
	/** Still fires while typing in a field (file and view chords); off for editing keys. */
	inText?: boolean;
	/** Listed in the sheet, not offered in the palette (modal keys, nudges, rows the editor owns). */
	sheetOnly?: boolean;
	when?: () => boolean;
	/**
	 * The key is the browser's own (⌘C, ⌘X, ⌘V): the keyboard router leaves it alone so the native
	 * clipboard event fires, and the canvas handles that; menus and the palette call `run`.
	 */
	native?: boolean;
	/** On/off for toggles, shown in the palette. */
	state?: () => boolean | null;
	run: () => void;
}

const k = (...specs: string[]) => specs.map(parse);
const classic = () => ui.layoutPreset === 'classic';
const CLASSIC_PANELS = [
	'sidebar',
	'navigator',
	'toolbar',
	'statusbar',
	'toolbox',
	'editors'
] as const;
const hasSelection = () => selection.size > 0;
const selectedClassifiers = () =>
	selection.list.filter((id) => projectStore.project.elements.get(id)?.kind === 'classifier');

// ---- display toggles: the selection when there is one, else the diagram defaults (board 15) ----

/** A classifier's flags as drawn: the diagram's defaults under its own overrides. */
export function effective(id: Id): DisplayFlags {
	const d = projectStore.diagram;
	const l = d.layout.get(id);
	return { ...d.defaults, ...(l?.kind === 'node' ? l.flags : undefined) };
}
export function flagState<K extends keyof DisplayFlags>(key: K): DisplayFlags[K] {
	const [first] = selectedClassifiers();
	return first ? effective(first)[key] : projectStore.diagram.defaults[key];
}
export function setFlag<K extends keyof DisplayFlags>(key: K, value: DisplayFlags[K]) {
	const ids = selectedClassifiers();
	const diagramId = projectStore.activeDiagramId;
	if (!ids.length) {
		projectStore.run(setDiagramDefaults, { diagramId, patch: { [key]: value } });
		return;
	}
	if (ids.length === 1) {
		projectStore.run(setNodeFlags, { diagramId, id: ids[0], patch: { [key]: value } });
		return;
	}
	const p = projectStore.project;
	projectStore.run(batch, {
		label: t('cmd.setNodeFlags', { what: t(`flag.${key}` as MessageKey) }),
		commands: ids.map((id) =>
			serialise(setNodeFlags(p, { diagramId, id, patch: { [key]: value } }))
		)
	});
}
const toggle = (key: keyof DisplayFlags & string) => () => setFlag(key, !flagState(key) as never);

const display = (
	id: string,
	key: keyof DisplayFlags,
	keys: string[],
	label: MessageKey
): AppCommand => ({
	id,
	group: 'display',
	label: () => t(label),
	keys: k(...keys),
	context: 'global',
	staruml: keys.length > 0,
	state: () => flagState(key) as boolean,
	run: toggle(key)
});

const lineStyle = (id: string, style: LineStyle, key: string): AppCommand => ({
	id,
	group: 'format',
	label: () => t(`cmd.lineStyle.${style}` as MessageKey),
	keys: k(key),
	context: 'global',
	staruml: true,
	when: () => selection.list.some((x) => projectStore.diagram.layout.get(x)?.kind === 'edge'),
	run: () => setLineStyleForSelection(style)
});

const create = (kind: ClassifierKind, key: string): AppCommand => ({
	id: `create.${kind}`,
	group: 'create',
	label: () => t(`cmd.create.${kind}` as MessageKey),
	keys: k(key),
	context: 'canvas',
	run: () => {
		ui.lastCreated = kind;
		canvasApi.create(kind);
	}
});

const nudge = (id: string, key: string, dx: number, dy: number, big = false): AppCommand => ({
	id,
	group: 'select',
	label: () => t(big ? 'cmd.nudgeBig' : 'cmd.nudge'),
	keys: k(key),
	context: 'canvas',
	sheetOnly: true,
	when: hasSelection,
	run: () => nudgeSelection(dx * (big ? 8 : 1), dy * (big ? 8 : 1))
});

/** ⇧+arrows resize the selected note (keyboard.md § Canvas keyboard model); packages wait for M3. */
const resize = (id: string, key: string, dw: number, dh: number): AppCommand => ({
	id,
	group: 'select',
	label: () => t('cmd.resizeNote'),
	keys: k(key),
	context: 'canvas',
	sheetOnly: true,
	when: () => selection.list.some((x) => projectStore.project.elements.get(x)?.kind === 'note'),
	run: () => resizeSelection(dw, dh)
});

const sheetRow = (
	id: string,
	group: Group,
	label: MessageKey,
	keys: string[],
	staruml = false
): AppCommand => ({
	id,
	group,
	label: () => t(label),
	keys: k(...keys),
	context: 'canvas',
	sheetOnly: true,
	staruml,
	// Documentation for the sheet: the editor or the canvas router owns the key, so the row never
	// dispatches (a dispatched no-op would swallow Tab and ⇧Tab on the canvas).
	when: () => false,
	run: () => {}
});

function switchDiagram(delta: number) {
	const ds = projectStore.project.diagrams;
	const i = ds.findIndex((d) => d.id === projectStore.activeDiagramId);
	const next = ds[(i + delta + ds.length) % ds.length];
	if (next) projectStore.activeDiagramId = next.id;
}

export const COMMANDS: AppCommand[] = [
	// Create and connect
	create('class', 'C'),
	create('interface', 'I'),
	create('enum', 'E'),
	create('dataType', 'D'),
	{
		id: 'create.note',
		group: 'create',
		label: () => t('cmd.create.note'),
		keys: k('N'),
		context: 'canvas',
		run: () => canvasApi.createNote()
	},
	{
		id: 'create.text',
		group: 'create',
		label: () => t('cmd.create.text'),
		keys: [],
		context: 'global',
		run: () => canvasApi.createText()
	},
	{
		id: 'create.repeat',
		group: 'create',
		label: () => t('cmd.create.repeat'),
		// No key: keyboard.md has none (owner's copy, 2026-10-21); the palette offers it.
		keys: [],
		context: 'global',
		when: () => ui.lastCreated !== null,
		// keyboard.md: placed to the right of the selection; at the cursor when nothing is selected.
		run: () => {
			if (!ui.lastCreated) return;
			const r = canvasApi.rects();
			const at = rightOf(selection.list.flatMap((id) => r.get(id) ?? []));
			canvasApi.create(ui.lastCreated, at ?? undefined);
		}
	},
	{
		id: 'link.start',
		group: 'create',
		label: () => t('cmd.link'),
		keys: k('L'),
		context: 'canvas',
		when: () => selection.size === 1,
		run: () => canvasApi.startLink()
	},
	sheetRow('link.kind', 'create', 'cmd.linkKind', ['1', '6']),
	{
		// features.md, Pin a tool: the palette and menu path beside the toolbox's double-click.
		id: 'tool.pin',
		group: 'create',
		label: () => t('cmd.pinTool'),
		keys: [],
		context: 'global',
		when: () => ui.tool !== 'select',
		state: () => ui.pinned === ui.tool,
		run: () => (ui.pinned = ui.pinned === ui.tool ? null : ui.tool)
	},

	// Edit
	{
		id: 'edit.start',
		group: 'edit',
		label: () => t('cmd.edit'),
		keys: k('F2', '↩'),
		context: 'canvas',
		staruml: true,
		when: () => selection.size === 1,
		run: startEditing
	},
	sheetRow('edit.addAttribute', 'edit', 'cmd.addAttributeBelow', ['⌘↩'], true),
	sheetRow('edit.addOperation', 'edit', 'cmd.addOperationBelow', ['⌘⇧↩'], true),
	sheetRow('edit.quickFix', 'edit', 'cmd.quickFix', ['⌥↩']),
	sheetRow('edit.compartment', 'edit', 'cmd.nextCompartment', ['Tab', '⇧Tab']),
	sheetRow('edit.moveMember', 'edit', 'cmd.moveMember', ['⌘↑', '⌘↓']),
	sheetRow('edit.moveMemberEnds', 'edit', 'cmd.moveMemberEnds', ['⌘⇧↑', '⌘⇧↓']),
	{
		id: 'edit.escape',
		group: 'edit',
		label: () => t('cmd.escape'),
		keys: k('Esc'),
		context: 'canvas',
		sheetOnly: true,
		// accessibility.md: editing → part → element → clear selection → leave the diagram.
		run: () => {
			const f = selection.focus;
			if (selection.editing) stopEditing();
			else if (ui.pinned || ui.tool !== 'select') {
				ui.pinned = null;
				ui.tool = 'select';
			} else if (f && f.part !== 'self') focusElement(f.id, 'self');
			else if (selection.size) selection.clear();
			else if (f) {
				selection.focus = null;
				canvasFocus.leave();
			}
		}
	},
	{
		id: 'edit.undo',
		group: 'edit',
		label: () => t('ui.undo'),
		keys: k('⌘Z'),
		context: 'global',
		inText: true,
		when: () => projectStore.canUndo,
		run: () => projectStore.undo()
	},
	{
		id: 'edit.redo',
		group: 'edit',
		label: () => t('ui.redo'),
		keys: k('⌘⇧Z', '⌘Y'),
		context: 'global',
		inText: true,
		when: () => projectStore.canRedo,
		run: () => projectStore.redo()
	},

	{
		id: 'edit.copy',
		group: 'edit',
		label: () => t('cmd.copy'),
		keys: k('⌘C'),
		context: 'canvas',
		staruml: true,
		native: true,
		when: hasSelection,
		run: () => copyFromMenu(false)
	},
	{
		id: 'edit.cut',
		group: 'edit',
		label: () => t('cmd.cut'),
		keys: k('⌘X'),
		context: 'canvas',
		staruml: true,
		native: true,
		when: hasSelection,
		run: () => copyFromMenu(true)
	},
	{
		id: 'edit.paste',
		group: 'edit',
		label: () => t('cmd.pasteHere'),
		keys: k('⌘V'),
		context: 'canvas',
		staruml: true,
		native: true,
		when: hasClipboard,
		run: () => {
			pasteFrom(null);
			canvasFocus.focus();
		}
	},

	// Select and arrange
	{
		id: 'select.all',
		group: 'select',
		label: () => t('cmd.selectAll'),
		keys: k('⌘A'),
		context: 'canvas',
		run: () => selection.set(projectStore.diagram.elementIds)
	},
	nudge('nudge.left', '⌘←', -1, 0),
	nudge('nudge.right', '⌘→', 1, 0),
	nudge('nudge.up', '⌘↑', 0, -1),
	nudge('nudge.down', '⌘↓', 0, 1),
	nudge('nudge.left.big', '⌘⇧←', -1, 0, true),
	nudge('nudge.right.big', '⌘⇧→', 1, 0, true),
	nudge('nudge.up.big', '⌘⇧↑', 0, -1, true),
	nudge('nudge.down.big', '⌘⇧↓', 0, 1, true),
	resize('resize.wider', '⇧→', 8, 0),
	resize('resize.narrower', '⇧←', -8, 0),
	resize('resize.taller', '⇧↓', 0, 8),
	resize('resize.shorter', '⇧↑', 0, -8),
	{
		id: 'delete.view',
		group: 'select',
		label: () => t('cmd.removeFromDiagram'),
		keys: k('⌫', 'Delete'),
		context: 'canvas',
		staruml: true,
		when: hasSelection,
		run: () => deleteSelection(false)
	},
	{
		id: 'delete.model',
		group: 'select',
		label: () => t('cmd.deleteFromModelCmd'),
		keys: k('⌘⌫'),
		context: 'canvas',
		staruml: true,
		when: hasSelection,
		run: () => deleteSelection(true)
	},
	{
		id: 'view.selectInOutline',
		group: 'select',
		label: () => t('cmd.selectInOutline'),
		keys: k('⌘E'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => {
			ui.panels.outline = true;
			explorerFocus.reveal(selection.list[0] ?? null);
		}
	},
	{
		id: 'view.selectInDiagram',
		group: 'select',
		label: () => t('cmd.selectInDiagram'),
		keys: k('⌘D'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => canvasFocus.focus()
	},

	// File
	{
		id: 'file.new',
		group: 'file',
		label: () => t('file.new'),
		keys: k('⌘N'),
		context: 'global',
		inText: true,
		run: () => void newProject()
	},
	{
		id: 'file.open',
		group: 'file',
		label: () => t('file.open'),
		keys: k('⌘O'),
		context: 'global',
		inText: true,
		run: () => void openFromPicker()
	},
	{
		id: 'file.save',
		group: 'file',
		label: () => t('file.save'),
		keys: k('⌘S'),
		context: 'global',
		inText: true,
		run: () => void saveFile()
	},
	{
		id: 'project.rename',
		group: 'file',
		label: () => t('ui.renameProject'),
		keys: [],
		context: 'global',
		run: () => (ui.renaming = 'project')
	},
	{
		id: 'file.saveAs',
		group: 'file',
		label: () => t('file.saveAs'),
		keys: k('⌘⇧S'),
		context: 'global',
		inText: true,
		run: () => void saveFile(true)
	},
	{
		id: 'file.export',
		group: 'file',
		label: () => t('export.title'),
		keys: k('⌘⇧E'),
		context: 'global',
		inText: true,
		run: () => (ui.exportOpen = true)
	},
	{
		id: 'file.copyImage',
		group: 'file',
		label: () => t('cmd.copyImage'),
		keys: k('⌘⇧C'),
		context: 'global',
		staruml: true,
		run: () => void copyDiagramAsPng()
	},

	// View and find
	{
		id: 'view.palette',
		group: 'view',
		label: () => t('ui.palette'),
		keys: k('⌘K', '⌘⇧P'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => (ui.paletteOpen = true)
	},
	{
		// features.md M2, Text view: the inspector's Text tab, open and focused (no key in keyboard.md).
		id: 'view.text',
		group: 'view',
		label: () => t('cmd.textView'),
		keys: [],
		context: 'global',
		run: () => {
			if (classic()) ui.classic.editors = true;
			else ui.panels.inspector = true;
			ui.inspectorTab = 'text';
			requestAnimationFrame(() => document.getElementById('text-view')?.focus());
		}
	},
	{
		// Owner's report: import had no visible home; the project menu and Classic's File menu list it.
		id: 'file.importPuml',
		group: 'file',
		label: () => t('cmd.importPuml'),
		keys: [],
		context: 'global',
		run: () => void importPumlProject()
	},
	{
		// features.md M2, Text view: ".puml import and export" (no key in keyboard.md).
		id: 'file.exportPuml',
		group: 'file',
		label: () => t('cmd.exportPuml'),
		keys: [],
		context: 'global',
		run: () => exportPuml()
	},
	{
		id: 'view.quickFind',
		group: 'view',
		label: () => t('cmd.quickFind'),
		keys: k('⌘P'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => (ui.quickFindOpen = true)
	},
	{
		// Owner's ruling #30; keyboard.md has no key for it.
		id: 'view.notationTips',
		group: 'view',
		label: () => t('cmd.notationTips'),
		keys: [],
		context: 'global',
		state: () => ui.notationTips,
		run: () => (ui.notationTips = !ui.notationTips)
	},
	{
		// features.md M2: the validation panel; keyboard.md has no key for it.
		id: 'view.validation',
		group: 'view',
		label: () => t('cmd.validation'),
		keys: [],
		context: 'global',
		state: () => validation.open,
		run: () => (validation.open = !validation.open)
	},
	...LOCALES.map((l): AppCommand => ({
		// features.md M2, i18n scaffolding: the locale switch (no key in keyboard.md).
		id: `view.locale.${l}`,
		group: 'view',
		label: () => t(`locale.${l}` as MessageKey),
		keys: [],
		context: 'global',
		state: () => locale.current === l,
		run: () => setLocale(l)
	})),
	{
		// accessibility.md: "A captions toggle in settings"; there is no settings panel, so it lives here.
		id: 'view.captions',
		group: 'view',
		label: () => t('cmd.captions'),
		keys: [],
		context: 'global',
		state: () => ui.captions,
		run: () => (ui.captions = !ui.captions)
	},
	{
		id: 'view.shortcuts',
		group: 'view',
		label: () => t('cmd.shortcuts'),
		keys: k('?'),
		context: 'canvas',
		run: () => (ui.shortcutsOpen = true)
	},
	{
		id: 'view.outline',
		group: 'view',
		label: () => t(classic() ? 'cmd.toggleExplorer' : 'cmd.toggleOutline'),
		keys: k('⌘B'),
		context: 'global',
		inText: true,
		state: () => (classic() ? ui.classic.navigator : ui.panels.outline),
		run: () => {
			if (classic()) ui.classic.navigator = !ui.classic.navigator;
			else ui.panels.outline = !ui.panels.outline;
		}
	},
	{
		id: 'view.inspector',
		group: 'view',
		label: () => t(classic() ? 'cmd.toggleEditors' : 'cmd.toggleInspector'),
		keys: k('⌘\\'),
		context: 'global',
		inText: true,
		state: () => (classic() ? ui.classic.editors : ui.panels.inspector),
		run: () => {
			if (classic()) ui.classic.editors = !ui.classic.editors;
			else ui.panels.inspector = !ui.panels.inspector;
		}
	},
	{
		id: 'view.layout',
		group: 'view',
		label: () => t(classic() ? 'cmd.layoutModern' : 'cmd.layoutClassic'),
		keys: k('⌘⇧L'),
		context: 'global',
		inText: true,
		run: () => (ui.layoutPreset = classic() ? 'modern' : 'classic')
	},
	// StarUML's Ctrl+1–6 (keyboard.md), only in Classic. Listed before zoom.fit so ⌘1 is the
	// Sidebar there and the fit alias everywhere else: the router skips a command whose `when` fails.
	...CLASSIC_PANELS.map((panel, i): AppCommand => ({
		id: `classic.${panel}`,
		group: 'view',
		label: () => t(`classic.toggle.${panel}`),
		keys: k(`⌘${i + 1}`),
		context: 'global',
		staruml: true,
		inText: true,
		when: classic,
		state: () => ui.classic[panel],
		run: () => (ui.classic[panel] = !ui.classic[panel])
	})),
	{
		id: 'zoom.in',
		group: 'view',
		label: () => t('ui.zoomIn'),
		keys: k('⌘='),
		context: 'global',
		inText: true,
		run: () => canvasApi.zoomBy(1.2)
	},
	{
		id: 'zoom.out',
		group: 'view',
		label: () => t('ui.zoomOut'),
		keys: k('⌘-'),
		context: 'global',
		inText: true,
		run: () => canvasApi.zoomBy(1 / 1.2)
	},
	{
		id: 'zoom.reset',
		group: 'view',
		label: () => t('ui.zoomReset'),
		keys: k('⌘0'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => canvasApi.zoomTo(1)
	},
	{
		id: 'zoom.fit',
		group: 'view',
		label: () => t('cmd.zoomFit'),
		keys: k('⌘9', '⌘1'),
		context: 'global',
		staruml: true,
		inText: true,
		run: () => canvasApi.fitAll()
	},
	{
		id: 'zoom.selection',
		group: 'view',
		label: () => t('cmd.zoomSelection'),
		// No key: keyboard.md has none (owner's copy, 2026-10-21); the palette offers it.
		keys: [],
		context: 'global',
		inText: true,
		run: () => (selection.size ? canvasApi.fitSelection() : canvasApi.fitAll())
	},
	{
		// Board 01's "+" tab: a new class diagram named after the default, numbered past the last.
		id: 'diagram.add',
		group: 'view',
		label: () => t('ui.addDiagram'),
		keys: [],
		context: 'global',
		inText: true,
		run: () => {
			const base = t('model.newDiagramName');
			const names = projectStore.project.diagrams.map((d) => d.name);
			let n = projectStore.project.diagrams.length + 1;
			while (names.includes(`${base} ${n}`)) n++;
			const diagramId = newId();
			projectStore.run(addDiagram, { diagramId, name: `${base} ${n}` });
			projectStore.activeDiagramId = diagramId;
			canvasFocus.focus();
		}
	},
	{
		id: 'diagram.rename',
		group: 'view',
		label: () => t('ui.renameDiagram'),
		keys: [],
		context: 'global',
		run: () => (ui.renaming = projectStore.activeDiagramId)
	},
	{
		// Deletes the views; the model keeps its elements. Undo from the toast, no confirm (board 19).
		id: 'diagram.delete',
		group: 'view',
		label: () => t('ui.deleteDiagram'),
		keys: [],
		context: 'global',
		when: () => projectStore.project.diagrams.length > 1,
		run: () => (ui.confirmDelete = { diagramId: projectStore.activeDiagramId })
	},
	{
		id: 'diagram.next',
		group: 'view',
		label: () => t('cmd.nextDiagram'),
		keys: k('⌘⇧]'),
		context: 'global',
		staruml: true,
		inText: true,
		when: () => projectStore.project.diagrams.length > 1,
		run: () => switchDiagram(1)
	},
	{
		id: 'diagram.prev',
		group: 'view',
		label: () => t('cmd.prevDiagram'),
		keys: k('⌘⇧['),
		context: 'global',
		staruml: true,
		inText: true,
		when: () => projectStore.project.diagrams.length > 1,
		run: () => switchDiagram(-1)
	},
	{
		id: 'view.theme',
		group: 'view',
		label: () => t('cmd.theme'),
		keys: k('⌘⌥T'),
		context: 'global',
		inText: true,
		run: cycleTheme
	},

	// Format
	lineStyle('format.rectilinear', 'rectilinear', '⌘L'),
	lineStyle('format.oblique', 'oblique', '⌘⇧B'),
	lineStyle('format.roundrect', 'roundrect', '⌘⌥L'),
	lineStyle('format.curve', 'curve', '⌘⌥B'),

	// Display (StarUML's keys; "Show property strings" has none, ⌘⇧P is the palette alias)
	display('display.visibility', 'showVisibility', ['⌘⇧V'], 'flag.showVisibility'),
	display('display.type', 'showType', ['⌘⇧Y'], 'flag.showType'),
	display('display.multiplicity', 'showMultiplicity', ['⌘⇧M'], 'flag.showMultiplicity'),
	display('display.signature', 'showOperationSignature', ['⌘⇧J'], 'flag.showOperationSignature'),
	display('display.namespace', 'showNamespace', ['⌘⇧N'], 'flag.showNamespace'),
	display('display.property', 'showProperty', [], 'flag.showProperty'),
	display('display.suppressAttributes', 'suppressAttributes', ['⌘⇧A'], 'flag.suppressAttributes'),
	display('display.suppressOperations', 'suppressOperations', ['⌘⇧O'], 'flag.suppressOperations'),
	display('display.suppressLiterals', 'suppressLiterals', ['⌘⇧T'], 'flag.suppressLiterals'),
	{
		id: 'display.stereotype.none',
		group: 'display',
		label: () => t('cmd.stereotypeNone'),
		keys: k('⌘⇧0'),
		context: 'global',
		staruml: true,
		state: () => flagState('stereotypeDisplay') === 'none',
		run: () => setFlag('stereotypeDisplay', 'none')
	},
	{
		id: 'display.stereotype.label',
		group: 'display',
		label: () => t('cmd.stereotypeLabel'),
		keys: k('⌘⇧1'),
		context: 'global',
		staruml: true,
		state: () => flagState('stereotypeDisplay') === 'label',
		run: () => setFlag('stereotypeDisplay', 'label')
	},
	display('display.autoResize', 'autoResize', ['⌘⇧R'], 'flag.autoResize'),
	display('display.wordWrap', 'wordWrap', [], 'flag.wordWrap')
];

/** After the confirm dialog: the views go, the model stays, the toast offers the way back. */
export function confirmDeleteDiagram(diagramId: Id) {
	const diagrams = projectStore.project.diagrams;
	const index = diagrams.findIndex((d) => d.id === diagramId);
	if (index < 0 || diagrams.length < 2) return;
	const name = diagrams[index].name;
	const next = diagrams[index === 0 ? 1 : index - 1].id;
	projectStore.run(deleteDiagram, { diagramId });
	if (projectStore.activeDiagramId === diagramId) projectStore.activeDiagramId = next;
	ui.toast = { text: t('toast.diagramDeleted', { name }), undo: true, at: Date.now() };
	canvasFocus.focus();
}

export const byId = (id: string) => COMMANDS.find((c) => c.id === id);
export function runCommand(id: string) {
	const c = byId(id);
	if (c && (!c.when || c.when())) c.run();
}
