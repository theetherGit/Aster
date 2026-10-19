<script lang="ts" module>
	/*
	 * One icon voice for the chrome (Hallmark: one set, one stroke). The path data is Lucide's
	 * (https://lucide.dev), ISC licence, copyright (c) Lucide contributors; vendored as data so no
	 * dependency ships for a dozen glyphs. Every icon is 24 × 24, stroke 2, round caps and joins.
	 */
	const PATHS = {
		x: ['M18 6 6 18', 'm6 6 12 12'],
		plus: ['M5 12h14', 'M12 5v14'],
		minus: ['M5 12h14'],
		// Lucide's grip-vertical: six dots, drawn as zero-length round-capped strokes.
		grip: ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'],
		pencil: [
			'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
			'm15 5 4 4'
		],
		trash: [
			'M3 6h18',
			'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6',
			'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
			'M10 11v6',
			'M14 11v6'
		],
		undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11'],
		redo: ['m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13'],
		'file-plus': [
			'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
			'M14 2v4a2 2 0 0 0 2 2h4',
			'M9 15h6',
			'M12 18v-6'
		],
		'folder-open': [
			'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'
		],
		save: [
			'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7',
			'M7 3v4a1 1 0 0 0 1 1h7'
		],
		'save-all': [
			'M10 2v3a1 1 0 0 0 1 1h5',
			'M18 18v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6',
			'M18 22H4a2 2 0 0 1-2-2V6',
			'M8 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 22 6.828V16a2 2 0 0 1-2.01 2z'
		],
		'panel-left': [
			'M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M9 3v18'
		],
		'panel-right': [
			'M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M15 3v18'
		],
		'panel-left-close': [
			'M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M9 3v18',
			'm16 15-3-3 3-3'
		],
		'panel-right-close': [
			'M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M15 3v18',
			'm8 9 3 3-3 3'
		],
		'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
		'arrow-up': ['m5 12 7-7 7 7', 'M12 19V5'],
		'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
		search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'm21 21-4.3-4.3'],
		'chevron-down': ['m6 9 6 6 6-6'],
		'chevron-right': ['m9 18 6-6-6-6'],
		terminal: ['m4 17 6-6-6-6', 'M12 19h8'],
		/* Aster's own tool glyphs (board 01), same grid and stroke. */
		'tool-select': ['M5 3l14 8-6 2-3 6z'],
		'tool-class': [
			'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
			'M4 10h16M4 15h16'
		],
		'tool-interface': ['M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z'],
		'tool-enum': [
			'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
			'M4 10h16M8 14h2M8 17h2M12 14h4M12 17h4'
		],
		'tool-link': ['M5 19L19 5', 'M12 5h7v7'],
		'tool-pin': ['M12 17v5', 'M9 3h6l-1 7 3 3H7l3-3z'],
		'tool-package': ['M3 6h7l2 2h9v11H3z', 'M3 10h18']
	} as const;
	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let {
		name,
		size = 14,
		stroke = 2,
		class: cls = ''
	}: { name: IconName; size?: number; stroke?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={cls}
	aria-hidden="true"
>
	{#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>
