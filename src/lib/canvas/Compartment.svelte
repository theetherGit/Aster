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
	const text = (m: Member) =>
		renderMember(kind, m, { ...flags, guillemets: true, keywords: false });

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
			class:editing={editing === i}
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
		<li class="member editing">
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
	<!-- Board 04: parse state, then the keys that matter right now. -->
	<div class="chip nodrag nopan" class:warn={!summary.ok}>
		<span class="dot" aria-hidden="true"></span>
		<span class="chip-summary" role="status">{summary.parts.join(t('member.summary.join'))}</span>
		<span class="chip-hint">{t(`member.hints.${kind}`)}</span>
	</div>
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
	/* The open line is a full-width accent band (ui.md selection tint); no border on the input. */
	.member.editing {
		margin: 0 -10px;
		padding: 0 10px;
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.member.static {
		text-decoration: underline;
	}
	.member.abstract {
		font-style: italic;
	}
	/* Board 12: a line kept as typed gets an amber wavy underline. */
	.member.raw {
		text-decoration: underline wavy var(--warning);
		text-decoration-skip-ink: none;
	}
	/* Parse summary chip under the node while a line is open (board 04). */
	.chip {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 30px;
		padding: 0 12px 0 10px;
		font-family: var(--font-sans);
		font-size: 12px;
		white-space: nowrap;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 6px;
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #3fb950;
	}
	.chip.warn .dot {
		background: var(--warning);
	}
	.chip-summary {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	.chip-hint {
		margin-left: 4px;
		color: var(--chrome-muted);
	}
</style>
