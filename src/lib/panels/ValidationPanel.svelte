<script lang="ts">
	import { jumpTo } from '#lib/canvas/actions.ts';
	import { flipRelationship } from '#lib/commands/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.ts';
	import type { Finding } from '#lib/model/validate.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { validation } from '#lib/stores/validation.svelte.ts';
	import Button from '#lib/ui/atoms/Button.svelte';
	import PanelHeader from '#lib/ui/molecules/PanelHeader.svelte';

	// features.md M2: StarUML's rules and ASTER001, live, each row a jump to its element; never
	// blocks saving. ASTER001 rows carry their one-button Flip.
	let region: HTMLElement;

	function message(f: Finding): string {
		if (f.rule === 'ASTER001') return t(`validation.ASTER001.${f.detail!}`, { name: f.subject });
		return t(`validation.${f.rule}` as MessageKey);
	}
	/** Where: the classifier, or "Book: isbn" for a member; "(unnamed)" when the name is missing. */
	function where(f: Finding): string {
		if (f.rule === 'ASTER001') return '';
		const owner = projectStore.project.elements.get(f.elementId);
		const ownerName = owner && 'name' in owner && owner.name ? owner.name : t('validation.unnamed');
		if (!f.memberId) return f.subject || ownerName;
		return t('validation.member', {
			owner: ownerName,
			member: f.subject || t('validation.unnamed')
		});
	}
	function flip(f: Finding) {
		projectStore.run(flipRelationship, { id: f.elementId });
		// The row and its button go with the warning; the panel keeps the keyboard.
		region.focus();
	}
</script>

<section
	bind:this={region}
	class="flex max-h-56 min-h-0 shrink-0 flex-col border-t border-chrome-border bg-chrome-surface text-chrome-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed"
	aria-labelledby="validation-title"
	tabindex="-1"
	data-panel="validation"
>
	<PanelHeader
		id="validation-title"
		title={t('validation.title')}
		closeLabel={t('validation.close')}
		onclose={() => (validation.open = false)}
	/>
	{#if validation.findings.length === 0}
		<p class="px-4 pb-3 text-(length:--text-body) text-chrome-muted">{t('validation.empty')}</p>
	{:else}
		<ul class="min-h-0 overflow-y-auto px-2 pb-2">
			{#each validation.findings as f, i (`${f.rule}/${f.elementId}/${f.memberId ?? ''}/${i}`)}
				<li class="flex items-center gap-2">
					<button
						type="button"
						class="flex min-h-(--control-min) min-w-0 flex-1 items-baseline gap-2 rounded-control px-2 py-1 text-start text-(length:--text-body) hover:bg-chrome-bg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-dashed"
						onclick={() => jumpTo(f.elementId)}
					>
						<span class="shrink-0 text-(length:--text-caption) font-semibold text-chrome-muted"
							>{f.rule}</span
						>
						<span>{message(f)}</span>
						{#if where(f)}<span class="truncate text-chrome-muted">{where(f)}</span>{/if}
					</button>
					{#if f.rule === 'ASTER001'}
						<Button size="sm" onclick={() => flip(f)}>{t('validation.flip')}</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
