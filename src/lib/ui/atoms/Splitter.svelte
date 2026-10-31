<script lang="ts">
	import { cn } from 'cn';

	// Atom: a divider that resizes the panel beside it. No Bits UI primitive is a splitter and a
	// role on a div is ruled out (CLAUDE.md rule 4), so the control is a real range input, visually
	// hidden, carrying the keys and screen readers; an 8 px strip laid over the 1 px border takes
	// the pointer on the same grid, and a double-click on it puts the default back. The range's
	// direction is set so the arrow toward the panel's growing side grows it.
	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 16,
		axis,
		panel,
		reset,
		perUnit = () => 1,
		testid,
		class: cls = ''
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		/** x: a column's width (a vertical divider); y: a stacked panel's height. */
		axis: 'x' | 'y';
		/** Which side of the divider the resized panel is on: before (start, top) or after. */
		panel: 'before' | 'after';
		/** The default a double-click on the strip puts back. */
		reset?: number;
		/** Screen pixels per unit of `value` (1 for px; a column's height over 100 for percent). */
		perUnit?: () => number;
		testid?: string;
		class?: string;
	} = $props();
	const id = $props.id();

	// The page's direction, read once the divider is in the document.
	let root: HTMLDivElement | undefined = $state();
	const rtl = $derived(root ? getComputedStyle(root).direction === 'rtl' : false);
	// A range grows toward the right (and up); a panel after an x divider grows toward the start.
	const rangeDir = $derived(axis === 'x' && (panel === 'after') !== rtl ? 'rtl' : 'ltr');

	function drag(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		const strip = e.currentTarget as HTMLElement;
		strip.setPointerCapture(e.pointerId);
		const at = (ev: PointerEvent) => (axis === 'x' ? ev.clientX : ev.clientY);
		const start = at(e);
		const from = value;
		const unit = perUnit() || 1;
		const sign =
			axis === 'x' ? ((panel === 'before') !== rtl ? 1 : -1) : panel === 'before' ? 1 : -1;
		const move = (ev: PointerEvent) => {
			const v = from + ((at(ev) - start) * sign) / unit;
			const snapped = min + Math.round((v - min) / step) * step;
			value = Math.max(min, Math.min(max, snapped));
		};
		const up = () => {
			strip.removeEventListener('pointermove', move);
			strip.removeEventListener('pointerup', up);
		};
		strip.addEventListener('pointermove', move);
		strip.addEventListener('pointerup', up);
	}
</script>

<div bind:this={root} class={cn('relative shrink-0', axis === 'x' ? 'w-0' : 'h-0', cls)}>
	<label for={id} class="sr-only">{label}</label>
	<input {id} type="range" class="peer sr-only" dir={rangeDir} {min} {max} {step} bind:value />
	<div
		data-testid={testid}
		aria-hidden="true"
		class={cn(
			'absolute z-(--z-splitter) bg-transparent peer-focus-visible:bg-accent hover:bg-accent/40',
			axis === 'x'
				? 'inset-y-0 -start-1 w-2 cursor-col-resize'
				: 'inset-x-0 -top-1 h-2 cursor-row-resize'
		)}
		onpointerdown={drag}
		ondblclick={() => reset !== undefined && (value = reset)}
	></div>
</div>
