/**
 * Class strings the atoms share and the few Bits-rendered parts no atom can wrap (a Select trigger,
 * a menu surface) reuse, so the dress is written once. Every value is a token through Tailwind's
 * theme or a `(--var)` reference; merge with `cn()` when a caller adds classes.
 */
export const field =
	'box-border h-(--control-icon) rounded-control border border-control-border bg-chrome-bg px-2 text-(length:--text-body) text-chrome-text placeholder:text-chrome-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:opacity-50';

export const menu =
	'z-(--z-dialog) min-w-35 rounded-menu border border-chrome-border bg-chrome-surface p-1 text-chrome-text shadow-menu';

export const menuItem =
	'flex h-(--control-icon) cursor-default items-center gap-2 rounded px-2 text-(length:--text-body) data-[highlighted]:bg-selection data-[disabled]:opacity-50 forced-colors:data-[highlighted]:bg-[Highlight] forced-colors:data-[highlighted]:text-[HighlightText]';

export const tooltip =
	'z-(--z-tooltip) max-w-70 rounded-control border border-chrome-border bg-chrome-surface px-2 py-1 text-(length:--text-small) text-chrome-text shadow-float';

export const focusRing =
	'focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-accent';
