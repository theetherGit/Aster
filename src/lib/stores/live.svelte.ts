/**
 * Live announcements (features.md, M2; accessibility.md): one polite and one assertive
 * `aria-live` region, mounted once at the app root by +layout.svelte. `announce` feeds the polite
 * one, `announceAssertive` the assertive one. The text is cleared before it is set again, on the next task,
 * so the same sentence twice is still read twice without recreating the region.
 */
class Live {
	text = $state('');
	alertText = $state('');
	n = $state(0);
}
export const live = new Live();

function say(field: 'text' | 'alertText', text: string) {
	live[field] = '';
	live.n++;
	setTimeout(() => (live[field] = text), 0);
}
export function announce(text: string) {
	say('text', text);
}
export function announceAssertive(text: string) {
	say('alertText', text);
}
