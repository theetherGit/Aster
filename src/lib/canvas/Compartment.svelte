<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { renderMember, type Member, type MemberKind } from '#lib/mdj/expression.ts';
	import type { DisplayFlags, Id } from '#lib/model/types.ts';
	import { byId } from '#lib/app/commands.svelte.ts';
	import { ariaKeys, format } from '#lib/app/shortcuts.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import LineEditor from './LineEditor.svelte';
	import { applySuggestion, edit } from './inline.ts';
	import { suggestFor, summarise } from './summary.ts';

	interface Props {
		classifierId: Id;
		kind: MemberKind;
		members: Member[];
		flags: DisplayFlags;
		/** Index of the line being edited, possibly `members.length` for a new line. */
		editing: number | null;
		/** Index of the line that owns roving focus. */
		focused: number | null;
	}
	let { classifierId, kind, members, flags, editing, focused }: Props = $props();

	let draft = $state('');
	const summary = $derived(editing === null ? null : summarise(kind, draft));
	// features.md: a type that names nothing offers "Create class X"; then "Link with association".
	const suggestion = $derived.by(() => {
		if (editing === null) return null;
		void projectStore.version;
		return suggestFor(projectStore.project, projectStore.diagram, classifierId, kind, draft);
	});
	const quickFix = byId('edit.quickFix')!.keys[0];
	const action = $derived(
		suggestion?.kind === 'create'
			? t('member.suggest.create', { name: suggestion.name })
			: suggestion?.kind === 'fix'
				? t('member.suggest.fix', { closer: suggestion.closer })
				: suggestion
					? t('member.suggest.link')
					: ''
	);
	let list: HTMLUListElement;
	/** A click on the chip: as ⌥↩ in the line; a fix goes into the open line's field. */
	function apply() {
		const fixed = applySuggestion(classifierId, kind, draft);
		const input = list?.querySelector<HTMLInputElement>('.member.editing input');
		if (typeof fixed !== 'string' || !input) return;
		input.value = fixed;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	const text = (m: Member) =>
		renderMember(kind, m, { ...flags, guillemets: true, keywords: false });

	function ondblclick(e: MouseEvent, index: number) {
		e.stopPropagation();
		edit(classifierId, { part: kind, index });
	}
</script>

<ul
	bind:this={list}
	class="compartment"
	class:empty={members.length === 0 && editing === null}
	data-compartment={kind}
	aria-label={t(`inspector.${kind}s`)}
	ondblclick={(e) => ondblclick(e, members.length)}
>
	{#each members as m, i (m.id)}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<li
			class="member"
			tabindex={focused === i ? 0 : -1}
			data-focus-id={classifierId}
			data-part="{kind}:{i}"
			class:editing={editing === i}
			class:static={'isStatic' in m && m.isStatic}
			class:raw={'raw' in m && m.raw !== undefined}
			class:abstract={'isAbstract' in m && m.isAbstract}
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
				<!-- Adjacent, so the line's text has no stray space; the raw note reads with the line, no hover needed. -->
				{text(m)}{#if 'raw' in m && m.raw !== undefined}<span class="sr-only">
						({t('inspector.unparsed')})</span
					>{/if}
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
		<span class="chip-summary">{summary.parts.join(t('member.summary.join'))}</span>
		{#if suggestion}
			<!-- A click applies without taking focus from the line (⌥↩ is the keyboard path). -->
			<button
				type="button"
				class="suggest"
				aria-keyshortcuts={ariaKeys(quickFix)}
				onpointerdown={(e) => e.preventDefault()}
				onclick={apply}>{action} <Kbd quiet>{format(quickFix)}</Kbd></button
			>
		{:else}
			<span class="chip-hint">{t(`member.hints.${kind}`)}</span>
		{/if}
		<!-- Announced when the parse state flips or a suggestion appears, not on every keystroke. -->
		<span class="sr-only" role="status"
			>{summary.ok ? t('member.summary.parsed') : t('member.summary.raw')}{#if suggestion}
				{t('member.suggest.available', {
					action:
						suggestion.kind === 'create'
							? t('member.suggest.createAny')
							: suggestion.kind === 'fix'
								? t('member.suggest.fixAny')
								: t('member.suggest.link'),
					key: format(quickFix)
				})}{/if}</span
		>
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
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
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
		/* Board 04's green for "parses"; no chrome token is a success colour (DECISIONS.md). */
		--chip-ok: #1e8a5f;
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 30px;
		padding: 0 var(--space-3) 0 10px;
		font-family: var(--font-chrome);
		font-size: var(--text-small);
		white-space: nowrap;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--control-radius);
		box-shadow: var(--shadow-float);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--chip-ok);
	}
	.chip.warn .dot {
		background: var(--warning);
	}
	.chip-summary {
		font-family: var(--font-mono);
	}
	.suggest {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
		height: var(--control-min);
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		font: inherit;
		color: var(--accent-text);
		border-radius: var(--control-radius);
	}
	.suggest:hover {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.suggest:focus-visible {
		outline: 2px dashed var(--accent);
	}
	.chip-hint {
		margin-left: var(--space-1);
		color: var(--chrome-muted);
	}
</style>
