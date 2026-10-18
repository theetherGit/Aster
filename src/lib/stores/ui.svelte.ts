import type { ClassifierKind, Id, RelationshipKind } from '#lib/model/types.ts';

export type Tool = 'select' | 'class' | 'interface' | 'enum' | 'package' | 'link';
export type Theme = 'system' | 'light' | 'dark' | 'high-contrast';
export type LayoutPreset = 'modern' | 'classic';

const THEME_KEY = 'aster:theme';
const storedTheme = (): Theme => {
	if (typeof localStorage === 'undefined') return 'system';
	const v = localStorage.getItem(THEME_KEY);
	return v === 'light' || v === 'dark' ? v : 'system';
};

class Ui {
	zoom = $state(1);
	/** System-following with a remembered override (features.md, themes). */
	theme: Theme = $state(storedTheme());
	layoutPreset: LayoutPreset = $state('modern');
	panels = $state({ outline: false, inspector: true });
	/** Which inspector tab shows (board 15: Diagram holds the display defaults). */
	inspectorTab: 'properties' | 'diagram' = $state('properties');
	tool: Tool = $state('select');
	/** Keyboard link in progress: arrows move the target highlight. */
	link: { sourceId: Id; targetId: Id } | null = $state(null);
	/** Relationship picker open at a client-space point. */
	picker: { sourceId: Id; targetId: Id; x: number; y: number } | null = $state(null);
	/** The picker's default: the kind chosen last. */
	lastRelationshipKind: RelationshipKind = $state('association');
	/** ⌘⇧D repeats the last kind created. */
	lastCreated: ClassifierKind | null = $state(null);
	/** Board 07 welcome: first visit until the user picks something. */
	welcome = $state(false);
	/** Owner's first-run ruling (#1): the sample shows a strip until the user starts their own work. */
	sampleStrip = $state(false);
	/** Board 06 export sheet, board 16 palette, board 17 shortcut sheet. */
	exportOpen = $state(false);
	paletteOpen = $state(false);
	shortcutsOpen = $state(false);
	/** Board 19: the last removal, undoable from a toast. */
	toast: { text: string; undo: boolean; at: number } | null = $state(null);
	/** Edge under the pointer: its two end nodes light up (features list #14). */
	hoveredEdge: Id | null = $state(null);
}

export const ui = new Ui();

/** ⌘⌥T: system → light → dark → system; remembered. */
export function cycleTheme() {
	const next: Theme = ui.theme === 'system' ? 'light' : ui.theme === 'light' ? 'dark' : 'system';
	setTheme(next);
}
export function setTheme(theme: Theme) {
	ui.theme = theme;
	if (typeof localStorage !== 'undefined') {
		if (theme === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, theme);
	}
}
