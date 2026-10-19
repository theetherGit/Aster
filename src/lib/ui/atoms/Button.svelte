<script lang="ts">
	import { cn } from 'cn';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// Atom: one native <button>, four voices (design.md § CTA voice), two heights. A disabled
	// button keeps its reason in `title`/`aria-description` from the caller; nothing hides it.
	let {
		variant = 'secondary',
		size = 'md',
		class: cls = '',
		children,
		...rest
	}: HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		children: Snippet;
	} = $props();

	const VARIANT = {
		primary: 'border-accent-fill bg-accent-fill font-semibold text-on-accent',
		secondary:
			'border-control-border text-chrome-text hover:enabled:border-accent hover:enabled:bg-chrome-surface',
		ghost:
			'border-transparent text-chrome-muted hover:enabled:bg-chrome-surface hover:enabled:text-chrome-text',
		danger: 'border-danger bg-danger font-semibold text-on-accent'
	};
	const SIZE = {
		md: 'h-(--control-bar) px-3 text-(length:--text-body)',
		sm: 'h-(--control-icon) px-2 text-(length:--text-small)'
	};
</script>

<button
	type="button"
	class={cn(
		'inline-flex items-center justify-center gap-1 rounded-control border leading-none font-medium whitespace-nowrap active:enabled:translate-y-px disabled:opacity-50 aria-disabled:opacity-50',
		VARIANT[variant],
		SIZE[size],
		cls
	)}
	{...rest}>{@render children()}</button
>
