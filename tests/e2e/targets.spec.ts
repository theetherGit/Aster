import { expect, test, type Page } from '@playwright/test';
import { canvasOf } from './helpers';

/**
 * features.md M2, "Pointer target and drag alternatives": every target is at least 24 × 24 CSS px,
 * or meets WCAG 2.5.8's spacing exception (a 24 px circle on its centre touches no other target).
 * Inline links in a sentence are exempt by the criterion.
 */
async function undersized(page: Page) {
	return page.evaluate(() => {
		const SEL =
			'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem], [role=treeitem], [role=radio], [role=checkbox], [role=switch], [role=option], .svelte-flow__handle';
		const els = [...document.querySelectorAll<HTMLElement>(SEL)].filter((el) => {
			const r = el.getBoundingClientRect();
			const s = getComputedStyle(el);
			return (
				r.width > 0 &&
				r.height > 0 &&
				s.visibility !== 'hidden' &&
				s.opacity !== '0' &&
				!el.closest('[aria-hidden="true"]') &&
				!el.closest('.sr-only') // visually hidden (a skip link at rest) is not a pointer target
			);
		});
		const rects = els.map((el) => el.getBoundingClientRect());
		const out: string[] = [];
		els.forEach((el, i) => {
			const r = rects[i];
			if (r.width >= 24 - 0.5 && r.height >= 24 - 0.5) return;
			// Inline: a link inside running text.
			if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return;
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const clear = rects.every((o, j) => {
				if (j === i || els[j].contains(el) || el.contains(els[j])) return true;
				const dx = Math.max(o.left - cx, 0, cx - o.right);
				const dy = Math.max(o.top - cy, 0, cy - o.bottom);
				return Math.hypot(dx, dy) >= 12;
			});
			if (!clear)
				out.push(
					`${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`
				);
		});
		return out;
	});
}

test('every target in the Modern editor is 24 px or spaced (WCAG 2.5.8)', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	// The audit itself: two 12 px buttons side by side are reported, one alone with room is not.
	await page.evaluate(() => {
		const box = document.createElement('div');
		box.id = 'probe';
		box.style.cssText = 'position:fixed;left:600px;top:400px;z-index:99999';
		box.innerHTML =
			'<button style="width:12px;height:12px;padding:0">a</button><button style="width:12px;height:12px;padding:0">b</button>' +
			'<button style="position:fixed;left:700px;top:500px;width:12px;height:12px;padding:0">c</button>';
		document.body.append(box);
	});
	const probe = (await undersized(page)).filter((s) => /"[abc]"/.test(s));
	expect(probe).toEqual(['button "a" 12×12', 'button "b" 12×12']);
	await page.evaluate(() => document.getElementById('probe')?.remove());

	await page.keyboard.press('ArrowRight'); // a selection: the inspector fills in
	expect(await undersized(page)).toEqual([]);
});

test('every target in the Classic editor is 24 px or spaced (WCAG 2.5.8)', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('aster:layout', 'classic'));
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ArrowRight');
	expect(await undersized(page)).toEqual([]);
});

test('every target on the welcome screen is 24 px or spaced (WCAG 2.5.8)', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(await undersized(page)).toEqual([]);
});
