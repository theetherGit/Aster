<script lang="ts">
	import { Select } from 'bits-ui';
	import { tick } from 'svelte';
	import { addMember, deleteMember, reorderMember, setMemberText } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import {
		memberFromText,
		renderMember,
		type Member,
		type MemberKind
	} from '#lib/mdj/expression.ts';
	import { newId } from '#lib/model/ids.ts';
	import { nextMemberText } from '#lib/model/project.ts';
	import type { Classifier, Visibility } from '#lib/model/types.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import Icon from './Icon.svelte';

	let { classifier, kind }: { classifier: Classifier; kind: MemberKind } = $props();

	const members = $derived<Member[]>(
		kind === 'attribute'
			? classifier.attributes
			: kind === 'operation'
				? classifier.operations
				: classifier.literals
	);
	let addButton: HTMLButtonElement;
	let list: HTMLUListElement;

	const SYMBOL: Record<Visibility, string> = {
		public: '+',
		protected: '#',
		private: '-',
		package: '~'
	};
	const visItems = (Object.keys(SYMBOL) as Visibility[]).map((v) => ({
		value: v,
		label: t('vis.option', { name: t(`vis.${v}`), symbol: SYMBOL[v] })
	}));
	const hasVisibility = $derived(kind !== 'literal');
	const isRaw = (m: Member) => 'raw' in m && m.raw !== undefined;

	/** Visibility goes through the same text command as inline editing: re-render the line, then parse it. */
	function setVisibility(m: Member, visibility: Visibility) {
		if (!('visibility' in m) || m.visibility === visibility) return;
		const text = renderMember(kind, { ...m, visibility });
		projectStore.run(setMemberText, { classifierId: classifier.id, kind, memberId: m.id, text });
	}

	/** A blank line is not a member: the field goes back to the model's text. */
	const commit = (m: Member, input: HTMLInputElement) => {
		const text = input.value.trim();
		if (!text) input.value = renderMember(kind, m);
		else if (text !== renderMember(kind, m))
			projectStore.run(setMemberText, { classifierId: classifier.id, kind, memberId: m.id, text });
	};
	const move = (m: Member, delta: number, i: number) => {
		const to = i + delta;
		if (to < 0 || to >= members.length) return; // aria-disabled: the button keeps focus, does nothing
		projectStore.run(reorderMember, { classifierId: classifier.id, kind, memberId: m.id, to });
	};
	async function remove(m: Member, i: number) {
		projectStore.run(deleteMember, { classifierId: classifier.id, kind, memberId: m.id });
		await tick();
		// The row's buttons are gone: the row that took its place, else the one above, else Add.
		const inputs = list.querySelectorAll<HTMLInputElement>('input');
		(inputs[Math.min(i, inputs.length - 1)] ?? addButton).focus();
	}
	function add() {
		const member = memberFromText(kind, nextMemberText(classifier, kind), newId());
		projectStore.run(addMember, { classifierId: classifier.id, kind, member });
	}
</script>

<!-- Board 01: heading with "+ Add" at the right; flat rows whose controls appear on hover or focus. -->
<fieldset class="mt-6 min-w-0" aria-labelledby="members-{kind}-title">
	<div class="mb-1 flex items-center justify-between">
		<h2 class="section mb-0" id="members-{kind}-title">{t(`inspector.${kind}s`)}</h2>
		<button
			type="button"
			bind:this={addButton}
			class="h-7 rounded-control border border-chrome-border px-2 text-[12px] hover:bg-chrome-bg"
			aria-label={t('inspector.add', { kind: t(`member.${kind}`) })}
			onclick={add}
		>
			<span class="inline-flex items-center gap-1"
				><Icon name="plus" size={12} />{t('inspector.addShort')}</span
			>
		</button>
	</div>
	<ul class="flex flex-col gap-1" bind:this={list}>
		{#each members as m, i (m.id)}
			<li class="group relative flex items-center">
				<input
					class="field h-8 min-w-0 flex-1 font-mono text-[13px]"
					class:raw={isRaw(m)}
					aria-label={t(`member.line.${kind}`)}
					aria-describedby={isRaw(m) ? `member-${m.id}-raw` : undefined}
					value={renderMember(kind, m)}
					onchange={(e) => commit(m, e.currentTarget)}
				/>
				{#if isRaw(m)}
					<span class="sr-only" id="member-{m.id}-raw">{t('inspector.unparsed')}</span>
				{/if}
				<!-- Hidden until hover or focus-within, and not hit-testable until then: a click at the
				     right end of the field reaches the field. The buttons stay in the Tab order. -->
				<span
					class="pointer-events-none absolute right-1 flex items-center gap-0.5 rounded-control bg-chrome-bg pl-1 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
				>
					{#if hasVisibility && 'visibility' in m}
						<Select.Root
							type="single"
							value={m.visibility}
							items={visItems}
							onValueChange={(v: string) => setVisibility(m, v as Visibility)}
						>
							<Select.Trigger
								class="field h-6 w-7 shrink-0 px-0 text-center font-mono"
								aria-label={t('inspector.memberVisibility', { name: m.name })}
								aria-describedby={isRaw(m) ? `member-${m.id}-raw` : undefined}
								disabled={isRaw(m)}
							>
								{SYMBOL[m.visibility]}
							</Select.Trigger>
							<Select.Portal>
								<Select.Content class="menu" sideOffset={4}>
									<Select.Viewport>
										{#each visItems as item (item.value)}
											<Select.Item value={item.value} label={item.label} class="menu-item">
												{item.label}
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					{/if}
					<!-- Edge rows use aria-disabled, not disabled: a real disabled button would drop focus. -->
					<button
						type="button"
						class="icon-btn h-6 w-6 aria-disabled:text-chrome-muted aria-disabled:opacity-60"
						aria-label={t('inspector.moveUp', { name: m.name })}
						aria-disabled={i === 0}
						onclick={() => move(m, -1, i)}><Icon name="arrow-up" size={12} /></button
					>
					<button
						type="button"
						class="icon-btn h-6 w-6 aria-disabled:text-chrome-muted aria-disabled:opacity-60"
						aria-label={t('inspector.moveDown', { name: m.name })}
						aria-disabled={i === members.length - 1}
						onclick={() => move(m, 1, i)}><Icon name="arrow-down" size={12} /></button
					>
					<button
						type="button"
						class="icon-btn h-6 w-6 text-danger"
						aria-label={t('inspector.remove', { name: m.name, owner: classifier.name })}
						onclick={() => remove(m, i)}><Icon name="x" size={12} stroke={2.5} /></button
					>
				</span>
			</li>
		{/each}
	</ul>
</fieldset>

<style>
	.raw {
		box-shadow: inset 0 -2px var(--warning);
	}
</style>
