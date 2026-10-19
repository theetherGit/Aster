<script lang="ts">
	import { cn } from 'cn';
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
	import Button from '#lib/ui/atoms/Button.svelte';
	import Field from '#lib/ui/atoms/Field.svelte';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import IconButton from '#lib/ui/atoms/IconButton.svelte';
	import SectionHeading from '#lib/ui/atoms/SectionHeading.svelte';
	import { field, menu, menuItem } from '#lib/ui/styles.ts';

	let { classifier, kind }: { classifier: Classifier; kind: MemberKind } = $props();

	const members = $derived<Member[]>(
		kind === 'attribute'
			? classifier.attributes
			: kind === 'operation'
				? classifier.operations
				: classifier.literals
	);
	let root: HTMLFieldSetElement;
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
		// The row's buttons are gone: the row that took its place, else the one above, else Add
		// (the fieldset's first button).
		const inputs = list.querySelectorAll<HTMLInputElement>('input');
		(inputs[Math.min(i, inputs.length - 1)] ?? root.querySelector('button'))?.focus();
	}
	function add() {
		const member = memberFromText(kind, nextMemberText(classifier, kind), newId());
		projectStore.run(addMember, { classifierId: classifier.id, kind, member });
	}
</script>

<!-- Board 01: heading with "+ Add" at the right; flat rows whose controls appear on hover or focus. -->
<fieldset class="mt-6 min-w-0" aria-labelledby="members-{kind}-title" bind:this={root}>
	<div class="head mb-1">
		<SectionHeading first id="members-{kind}-title">{t(`inspector.${kind}s`)}</SectionHeading>
		<Button size="sm" aria-label={t('inspector.add', { kind: t(`member.${kind}`) })} onclick={add}>
			<Icon name="plus" size={12} />{t('inspector.addShort')}
		</Button>
	</div>
	<ul class="rows flex flex-col gap-1" bind:this={list}>
		{#each members as m, i (m.id)}
			<li class="group relative flex items-center">
				<Field
					class="min-w-0 flex-1 font-mono {isRaw(m) ? 'raw' : ''}"
					aria-label={t(`member.line.${kind}`)}
					aria-describedby={isRaw(m) ? `member-${m.id}-raw` : undefined}
					value={renderMember(kind, m)}
					onchange={(e: Event) => commit(m, e.currentTarget as HTMLInputElement)}
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
						<!-- The Select atom shows the chosen label; this trigger shows the symbol, so it
						     stays a Bits Select in the field dress. -->
						<Select.Root
							type="single"
							value={m.visibility}
							items={visItems}
							onValueChange={(v: string) => setVisibility(m, v as Visibility)}
						>
							<Select.Trigger
								class={cn(field, 'h-6 w-7 shrink-0 px-0 text-center font-mono')}
								aria-label={t('inspector.memberVisibility', { name: m.name })}
								aria-describedby={isRaw(m) ? `member-${m.id}-raw` : undefined}
								disabled={isRaw(m)}
							>
								{SYMBOL[m.visibility]}
							</Select.Trigger>
							<Select.Portal>
								<Select.Content class={menu} sideOffset={4}>
									<Select.Viewport>
										{#each visItems as item (item.value)}
											<Select.Item value={item.value} label={item.label} class={menuItem}>
												{item.label}
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					{/if}
					<!-- Edge rows use aria-disabled, not disabled: a real disabled button would drop focus. -->
					<IconButton
						label={t('inspector.moveUp', { name: m.name })}
						icon="arrow-up"
						iconSize={12}
						size={24}
						tip={false}
						aria-disabled={i === 0 || undefined}
						onclick={() => move(m, -1, i)}
					/>
					<IconButton
						label={t('inspector.moveDown', { name: m.name })}
						icon="arrow-down"
						iconSize={12}
						size={24}
						tip={false}
						aria-disabled={i === members.length - 1 || undefined}
						onclick={() => move(m, 1, i)}
					/>
					<IconButton
						label={t('inspector.remove', { name: m.name, owner: classifier.name })}
						icon="x"
						iconSize={12}
						stroke={2.5}
						size={24}
						tip={false}
						class="text-danger"
						onclick={() => remove(m, i)}
					/>
				</span>
			</li>
		{/each}
	</ul>
</fieldset>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* The heading shares a row with Add: no bottom gap of its own. */
	.head > :global(.section) {
		margin: 0;
	}
	/* A line the grammar could not parse keeps the model's raw text, underlined in amber. */
	.rows :global(.raw) {
		box-shadow: inset 0 -2px var(--warning);
	}
</style>
