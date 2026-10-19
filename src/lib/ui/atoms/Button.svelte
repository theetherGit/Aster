<script lang="ts">
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
</script>

<button type="button" class="btn {variant} {size} {cls}" {...rest}>{@render children()}</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		height: var(--control-icon);
		padding: 0 var(--space-3);
		font-size: var(--text-body);
		font-weight: 500;
		line-height: 1;
		color: var(--chrome-text);
		white-space: nowrap;
		border: 1px solid var(--control-border);
		border-radius: var(--control-radius);
	}
	.md {
		height: var(--control-bar);
	}
	.sm {
		height: var(--control-icon);
		font-size: var(--text-small);
		padding: 0 var(--space-2);
	}
	.secondary:hover:not(:disabled):not([aria-disabled]) {
		background: var(--chrome-surface);
		border-color: var(--accent);
	}
	.primary {
		font-weight: 600;
		color: var(--on-accent);
		background: var(--accent-fill);
		border-color: var(--accent-fill);
	}
	.danger {
		font-weight: 600;
		color: var(--on-accent);
		background: var(--danger);
		border-color: var(--danger);
	}
	.ghost {
		color: var(--chrome-muted);
		border-color: transparent;
	}
	.ghost:hover:not(:disabled):not([aria-disabled]) {
		color: var(--chrome-text);
		background: var(--chrome-surface);
	}
	.btn:active:not(:disabled) {
		transform: translateY(1px);
	}
	.btn:disabled,
	.btn[aria-disabled='true'] {
		opacity: 0.5;
	}
</style>
