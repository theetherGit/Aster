<script lang="ts">
	import { drawer } from '@lucasmarkes/hairline';
	import { hairline } from '#lib/actions/hairline.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import { t } from '#lib/i18n/index.ts';
	// Board 18: an empty class diagram says what the keys do, read from the registry so the glyphs
	// follow the platform (⌘ here, Ctrl there). Pointer events pass through to the paper.
	const key = (id: string) => format(byId(id)!.keys[0]);
	const KEYS: [string, string][] = [
		[key('create.class'), t('empty.class')],
		[key('create.interface'), t('empty.interface')],
		[key('create.enum'), t('empty.enum')],
		[key('create.dataType'), t('empty.dataType')],
		[key('create.note'), t('empty.note')],
		[key('view.palette'), t('empty.palette')],
		[key('view.shortcuts'), t('empty.shortcuts')]
	];
</script>

<div class="hint">
	<div
		class="mb-3 w-[200px]"
		use:hairline={{ figure: drawer, label: t('empty.figure'), intensity: 0.4, play: false }}
	></div>
	<p class="text-(length:--text-title) font-semibold">{t('empty.title')}</p>
	<p class="mt-1 text-(length:--text-body)">{t('empty.body')}</p>
	<dl class="keys">
		{#each KEYS as [glyph, label] (glyph)}
			<div>
				<dt><kbd>{glyph}</kbd></dt>
				<dd>{label}</dd>
			</div>
		{/each}
	</dl>
	<p class="mt-4 text-(length:--text-body)">
		{t('empty.open')} <kbd>{key('file.open')}</kbd>{t('empty.openTail')}
	</p>
</div>

<style>
	.hint {
		--hairline-plate: var(--paper-bg);
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--paper-muted);
		text-align: center;
		pointer-events: none;
	}
	.hint p:first-of-type {
		color: var(--paper-ink);
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(2, 160px);
		gap: var(--space-2) var(--space-6);
		margin-top: var(--space-5);
		text-align: start;
	}
	.keys div {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-field);
		color: var(--paper-ink);
	}
	.keys dd {
		margin: 0;
	}
	/* Not the Kbd atom: that cap wears chrome colours, and this one sits on the paper, which is
	   white in every theme, so it takes the paper's ink and its muted edge. */
	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--control-min);
		height: var(--control-min);
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		color: var(--paper-ink);
		background: var(--paper-bg);
		border: 1px solid var(--paper-muted);
		border-radius: var(--control-radius);
	}
</style>
