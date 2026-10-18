import type { Id, RelationshipKind } from '#lib/model/types.ts';

export type Tool = 'select' | 'class' | 'interface' | 'enum' | 'package' | 'link';
export type Theme = 'system' | 'light' | 'dark' | 'high-contrast';
export type LayoutPreset = 'modern' | 'classic';

class Ui {
	zoom = $state(1);
	theme: Theme = $state('system');
	layoutPreset: LayoutPreset = $state('modern');
	panels = $state({ outline: false, inspector: true });
	tool: Tool = $state('select');
	/** Keyboard link in progress: arrows move the target highlight. */
	link: { sourceId: Id; targetId: Id } | null = $state(null);
	/** Edge under the pointer: its two end nodes light up (features list #14). */
	hoveredEdge: Id | null = $state(null);
	/** Relationship picker open at a client-space point. */
	picker: { sourceId: Id; targetId: Id; x: number; y: number } | null = $state(null);
	/** The picker's default: the kind chosen last. */
	lastRelationshipKind: RelationshipKind = $state('association');
}

export const ui = new Ui();
