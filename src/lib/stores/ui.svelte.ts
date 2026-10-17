export type Tool = 'select' | 'class' | 'interface' | 'enum' | 'package' | 'link';
export type Theme = 'system' | 'light' | 'dark' | 'high-contrast';
export type LayoutPreset = 'modern' | 'classic';

class Ui {
	zoom = $state(1);
	theme: Theme = $state('system');
	layoutPreset: LayoutPreset = $state('modern');
	panels = $state({ outline: false, inspector: true });
	tool: Tool = $state('select');
}

export const ui = new Ui();
