import { PersistedState } from 'runed';
import type { ClassifierKind, Id, RelationshipKind } from '#lib/model/types.ts';

export type Tool = 'select' | 'class' | 'interface' | 'enum' | 'package' | 'link';
export type Theme = 'system' | 'light' | 'dark' | 'high-contrast';
export type LayoutPreset = 'modern' | 'classic';

/** The layout preset (overview.md: "Switching is one toggle and is remembered"), raw in localStorage. */
const storedLayout = new PersistedState<LayoutPreset>('aster:layout', 'modern', {
	serializer: { serialize: (v) => v, deserialize: (v) => (v === 'classic' ? 'classic' : 'modern') }
});
/** The remembered override: raw `light` | `dark` | `system` in localStorage, synced across tabs. */
const storedTheme = new PersistedState<Theme>('aster:theme', 'system', {
	serializer: {
		serialize: (v) => v,
		deserialize: (v) => (v === 'light' || v === 'dark' || v === 'high-contrast' ? v : 'system')
	}
});

/** The Outline drawer: open by default on a wide window, remembered per browser afterwards. */
const storedOutline = new PersistedState<boolean>(
	'aster:outline',
	typeof window !== 'undefined' && window.innerWidth >= 1280,
	{ serializer: { serialize: (v) => (v ? '1' : '0'), deserialize: (v) => v === '1' } }
);
/** Owner's request: the Text tab's inspector width, resizable and remembered (ui.md's 360 by default). */
const storedTextWidth = new PersistedState<number>('aster:textWidth', 360, {
	serializer: {
		serialize: (v) => String(v),
		deserialize: (v) => (Number.isFinite(Number(v)) ? Number(v) : 360)
	}
});
/** keyboard.md ⌘G / ⌘⇧G (StarUML's keys): the paper grid is shown, snapping is off, both remembered. */
const storedGrid = new PersistedState<boolean>('aster:grid', true, {
	serializer: { serialize: (v) => (v ? '1' : '0'), deserialize: (v) => v !== '0' }
});
const storedSnap = new PersistedState<boolean>('aster:snap', false, {
	serializer: { serialize: (v) => (v ? '1' : '0'), deserialize: (v) => v === '1' }
});
/** Owner's ruling #30: notation tooltips on paper, on by default, remembered. */
const storedTips = new PersistedState<boolean>('aster:notationTips', true, {
	serializer: { serialize: (v) => (v ? '1' : '0'), deserialize: (v) => v !== '0' }
});
/** accessibility.md: the captions toggle shows the live region as a narration bar; remembered. */
const storedCaptions = new PersistedState<boolean>('aster:captions', false, {
	serializer: { serialize: (v) => (v ? '1' : '0'), deserialize: (v) => v === '1' }
});
class Panels {
	get outline() {
		return storedOutline.current;
	}
	set outline(v: boolean) {
		storedOutline.current = v;
	}
	inspector = $state(true);
}

class Ui {
	zoom = $state(1);
	/** System-following with a remembered override (features.md, themes). */
	get theme(): Theme {
		return storedTheme.current;
	}
	set theme(v: Theme) {
		storedTheme.current = v;
	}
	get layoutPreset(): LayoutPreset {
		return storedLayout.current;
	}
	set layoutPreset(v: LayoutPreset) {
		storedLayout.current = v;
		if (v === 'modern' && this.inspectorTab === 'documentation') this.inspectorTab = 'properties';
	}
	panels = new Panels();
	get textWidth(): number {
		return storedTextWidth.current;
	}
	set textWidth(v: number) {
		storedTextWidth.current = Math.round(v);
	}
	get notationTips(): boolean {
		return storedTips.current;
	}
	set notationTips(v: boolean) {
		storedTips.current = v;
	}
	/** Tooltips on markers and visibility symbols: Modern only (Classic is StarUML's plain paper). */
	get showNotationTips(): boolean {
		return this.notationTips && this.layoutPreset === 'modern';
	}
	get showGrid(): boolean {
		return storedGrid.current;
	}
	set showGrid(v: boolean) {
		storedGrid.current = v;
	}
	get snap(): boolean {
		return storedSnap.current;
	}
	set snap(v: boolean) {
		storedSnap.current = v;
	}
	get captions(): boolean {
		return storedCaptions.current;
	}
	set captions(v: boolean) {
		storedCaptions.current = v;
	}
	/** An in-place name editor is open: the project name, or a diagram tab by id. */
	renaming: 'project' | Id | null = $state(null);
	/** The confirm-delete dialog for a diagram. */
	confirmDelete: { diagramId: Id } | null = $state(null);
	/** Classic's six panels, StarUML's Ctrl+1–6 (keyboard.md). */
	classic = $state({
		sidebar: true,
		navigator: true,
		toolbar: true,
		statusbar: true,
		toolbox: true,
		editors: true
	});
	/** Which inspector tab shows (board 15: Diagram holds the display defaults); Classic's Editors add Documentation. */
	inspectorTab: 'properties' | 'text' | 'diagram' | 'documentation' = $state('properties');
	/** Set by the palette's "Text view": the Text tab's editor takes focus once it has loaded. */
	focusText = $state(false);
	tool: Tool = $state('select');
	/** features.md, Pin a tool: a double-clicked tool keeps placing until Esc or another tool. */
	pinned: Tool | null = $state(null);
	/** Keyboard link in progress: arrows move the target highlight. */
	link: { sourceId: Id; targetId: Id } | null = $state(null);
	/** Relationship picker open at a client-space point. */
	picker: {
		sourceId: Id;
		targetId: Id;
		x: number;
		y: number;
		/** Where focus goes when the picker closes; the canvas when unset (the Outline sets its row). */
		restore?: () => void;
	} | null = $state(null);
	/** The picker's default: the kind chosen last. */
	lastRelationshipKind: RelationshipKind = $state('association');
	/** The palette's "Repeat last create" makes this kind again. */
	lastCreated: ClassifierKind | null = $state(null);
	/** Owner's first-run ruling (#1): the sample shows a strip until the user starts their own work. */
	sampleStrip = $state(false);
	/** Board 06 export sheet, board 16 palette, board 17 shortcut sheet. */
	exportOpen = $state(false);
	paletteOpen = $state(false);
	/** features.md M2: ⌘P quick find. */
	quickFindOpen = $state(false);
	shortcutsOpen = $state(false);
	/** Board 19: the last removal, undoable from a toast. */
	toast: { text: string; undo: boolean; at: number } | null = $state(null);
	/** Edge under the pointer: its two end nodes light up (features list #14). */
	hoveredEdge: Id | null = $state(null);
}

export const ui = new Ui();

/** ⌘⌥T: system → light → dark → high contrast → system (keyboard.md); remembered. */
export function cycleTheme() {
	const order: Theme[] = ['system', 'light', 'dark', 'high-contrast'];
	setTheme(order[(order.indexOf(ui.theme) + 1) % order.length]);
}
export function setTheme(theme: Theme) {
	ui.theme = theme;
}
