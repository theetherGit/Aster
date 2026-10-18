<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { renderMember, type Member, type MemberKind } from '#lib/mdj/expression.ts';
	import type { DisplayFlags, Id } from '#lib/model/types.ts';
	import LineEditor from './LineEditor.svelte';
	import { edit } from './inline.ts';
	import { summarise } from './summary.ts';

	interface Props {
		classifierId: Id;
		kind: MemberKind;
		members: Member[];
		flags: DisplayFlags;
		/** Index of the line being edited, possibly `members.length` for a new line. */
		editing: number | null;
	}
	let { classifierId, kind, members, flags, editing }: Props = $props();

	let draft = $state('');
	const summary = $derived(editing === null ? null : summarise(kind, draft));
	const text = (m: Member) => renderMember(kind, m, { ...flags, guillemets: true });

	function ondblclick(e: MouseEvent, index: number) {
		e.stopPropagation();
		edit(classifierId, { part: kind, index });
	}
</script>

<ul
	class="compartment"
	class:empty={members.length === 0 && editing === null}
	data-compartment={kind}
	aria-label={t(`inspector.${kind}s`)}
	ondblclick={(e) => ondblclick(e, members.length)}
>
	{#each members as m, i (m.id)}
		<li
			class="member"
			class:static={'isStatic' in m && m.isStatic}
			class:raw={'raw' in m && m.raw !== undefined}
			class:abstract={'isAbstract' in m && m.isAbstract}
			title={'raw' in m && m.raw !== undefined ? t('inspector.unparsed') : undefined}
			ondblclick={(e) => ondblclick(e, i)}
		>
			{#if editing === i}
				{#key i}
					<LineEditor
						id={classifierId}
						target={{ part: kind, index: i }}
						initial={renderMember(kind, m)}
						label=""
						ondraft={(d) => (draft = d)}
					/>
				{/key}
			{:else}
				{text(m)}
			{/if}
		</li>
	{/each}
	{#if editing !== null && editing >= members.length}
		<li class="member">
			{#key editing}
				<LineEditor
					id={classifierId}
					target={{ part: kind, index: editing }}
					initial=""
					label=""
					ondraft={(d) => (draft = d)}
				/>
			{/key}
		</li>
	{/if}
</ul>
{#if summary}
	<div class="chip nodrag nopan" class:warn={!summary.ok} role="status">{summary.text}</div>
{/if}

<style>
	.compartment {
		margin: 0;
		padding: 6px 10px;
		list-style: none;
		border-top: var(--uml-stroke) solid var(--paper-ink);
	}
	.compartment.empty {
		height: 8px;
		padding: 0;
	}
	.member {
		height: 20px;
	}
	.member.static {
		text-decoration: underline;
	}
	.member.abstract {
		font-style: italic;
	}
	/* Thin warning underline for lines kept verbatim; box-shadow so it stacks with static. */
	.member.raw {
		box-shadow: inset 0 -1px var(--warning);
	}
	/* Parse summary chip under the node while a line is open (board 04). */
	.chip {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		max-width: 320px;
		padding: 2px 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		line-height: 16px;
		white-space: normal;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
	}
	.chip.warn {
		border-color: var(--warning);
	}
</style>
