<script lang="ts">
	import { drawer } from '@lucasmarkes/hairline';
	import { hairline } from '#lib/actions/hairline.ts';
	import { t } from '#lib/i18n/index.ts';
	// Board 18: an empty class diagram says what the keys do. Pointer events pass through to the paper.
	const KEYS: [string, string][] = [
		['C', t('empty.class')],
		['I', t('empty.interface')],
		['E', t('empty.enum')],
		['D', t('empty.dataType')]
	];
</script>

<div class="hint">
	<div
		class="mb-3 w-[200px]"
		use:hairline={{ figure: drawer, label: t('empty.figure'), intensity: 0.4, play: true }}
	></div>
	<p class="text-[17px] font-semibold">{t('empty.title')}</p>
	<p class="mt-1 text-[13px]">{t('empty.body')}</p>
	<dl class="keys">
		{#each KEYS as [key, label] (key)}
			<div>
				<kbd>{key}</kbd>
				<dd>{label}</dd>
			</div>
		{/each}
	</dl>
	<p class="mt-4 text-[13px]">
		{t('empty.open')} <kbd>{t('file.openShortcut')}</kbd>{t('empty.openTail')}
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
		color: #6b6b78;
		text-align: center;
		pointer-events: none;
	}
	.hint p:first-child {
		color: var(--paper-ink);
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(2, 160px);
		gap: 10px 24px;
		margin-top: 20px;
		text-align: left;
	}
	.keys div {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		color: var(--paper-ink);
	}
	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		color: var(--paper-ink);
		background: #fff;
		border: 1px solid #c9c9d1;
		border-radius: 5px;
	}
</style>
