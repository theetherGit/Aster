<script lang="ts">
	import { Select } from 'bits-ui';
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

	let { classifier, kind }: { classifier: Classifier; kind: MemberKind } = $props();

	const members = $derived<Member[]>(
		kind === 'attribute'
			? classifier.attributes
			: kind === 'operation'
				? classifier.operations
				: classifier.literals
	);
	let addButton: HTMLButtonElement;

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

	const commit = (m: Member, text: string) => {
		if (text.trim() && text.trim() !== renderMember(kind, m))
			projectStore.run(setMemberText, {
				classifierId: classifier.id,
				kind,
				memberId: m.id,
				text: text.trim()
			});
	};
	const move = (m: Member, delta: number, i: number) =>
		projectStore.run(reorderMember, {
			classifierId: classifier.id,
			kind,
			memberId: m.id,
			to: i + delta
		});
	function remove(m: Member) {
		projectStore.run(deleteMember, { classifierId: classifier.id, kind, memberId: m.id });
		addButton.focus(); // the row's buttons are gone; focus must land somewhere real
	}
	function add() {
		const member = memberFromText(kind, nextMemberText(classifier, kind), newId());
		projectStore.run(addMember, { classifierId: classifier.id, kind, member });
	}
</script>

<!-- Board 01: heading with "+ Add" at the right; flat rows whose controls appear on hover or focus. -->
<fieldset class="mt-5 min-w-0">
	<div class="mb-1 flex items-center justify-between">
		<legend class="section float-left mb-0">{t(`inspector.${kind}s`)}</legend>
		<button
			type="button"
			bind:this={addButton}
			class="h-7 rounded-control border border-chrome-border px-2 text-[12px] hover:bg-chrome-bg"
			aria-label={t('inspector.add', { kind: t(`member.${kind}`) })}
			onclick={add}
		>
			+ {t('inspector.addShort')}
		</button>
	</div>
	<ul class="flex flex-col gap-1">
		{#each members as m, i (m.id)}
			<li class="group relative flex items-center">
				<input
					class="field h-8 min-w-0 flex-1 font-mono text-[13px]"
					class:raw={'raw' in m && m.raw !== undefined}
					aria-label={t(`member.line.${kind}`)}
					title={'raw' in m && m.raw !== undefined ? t('inspector.unparsed') : undefined}
					value={renderMember(kind, m)}
					onchange={(e) => commit(m, e.currentTarget.value)}
				/>
				<span
					class="absolute right-1 flex items-center gap-0.5 rounded-control bg-chrome-bg pl-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
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
					<button
						type="button"
						class="icon-btn h-6 w-6"
						aria-label={t('inspector.moveUp', { name: m.name })}
						disabled={i === 0}
						onclick={() => move(m, -1, i)}>↑</button
					>
					<button
						type="button"
						class="icon-btn h-6 w-6"
						aria-label={t('inspector.moveDown', { name: m.name })}
						disabled={i === members.length - 1}
						onclick={() => move(m, 1, i)}>↓</button
					>
					<button
						type="button"
						class="icon-btn h-6 w-6 text-danger"
						aria-label={t('inspector.remove', { name: m.name })}
						onclick={() => remove(m)}>×</button
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
