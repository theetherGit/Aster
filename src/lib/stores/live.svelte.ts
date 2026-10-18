/**
 * Live announcements (features.md, M2): one polite `aria-live` region in the editor narrates
 * every command result. The region is rendered once by the editor page; `announce` feeds it.
 * `n` changes with every call so the same text twice is still read twice.
 */
class Live {
	text = $state('');
	n = $state(0);
}
export const live = new Live();

export function announce(text: string) {
	live.text = text;
	live.n++;
}
