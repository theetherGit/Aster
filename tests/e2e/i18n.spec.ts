import { expect, test, type Page } from '@playwright/test';
import { canvasOf, node } from './helpers';

test('?locale=pseudo switches every chrome string to the bracketed pseudo-locale', async ({
	page
}) => {
	await page.goto('/design/sample?locale=pseudo');
	await expect(
		page.getByRole('application', { name: /^\[Diagram canvas: Main~+\]$/ })
	).toBeVisible();
	await expect(page.getByRole('toolbar', { name: /^\[Toolbox~+\]$/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^\[Zoom in~+\]$/ })).toBeVisible();
	await page.goto('/design/sample');
	await expect(page.getByRole('application', { name: 'Diagram canvas: Main' })).toBeVisible();
});

/**
 * features.md M2, i18n scaffolding: "A pseudo-locale renders with no clipped or concatenated
 * strings". Every visible chrome text is inside a bracketed message (user data excepted: the
 * sample's names, key caps), and no chrome element cuts its text off without an ellipsis.
 */
// File names and extensions (the export sheet) are data, not messages.
const USER_DATA =
	/^(Library|Main|Account|Customer|entity|attribute\d|operation\d|Class diagram \d|[←→↑↓] \w+|String|int|boolean|void|\.\w+|[\w@-]+\.(png|svg|mdj|aster))$/;
const KEY_CAP = /^(⌘|⇧|⌥|Ctrl|Shift|Alt|Esc|Tab|Space|Del|F\d+|[A-Z0-9?=−\\[\]/↩⌫←↑→↓+]|\d–\d)+$/;
async function audit(page: Page) {
	return page.evaluate(
		([userData, keyCap]) => {
			const user = new RegExp(userData);
			const key = new RegExp(keyCap);
			const skip = (el: Element) =>
				!!el.closest(
					'.svelte-flow__nodes, .svelte-flow__edges, [role=tree], .sr-only, [aria-hidden=true], input, textarea, code, pre'
				);
			const plain: string[] = [];
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const s = n.textContent!.trim();
				const el = n.parentElement!;
				// Judged by the element that holds it: one message may be split for styling (a <code>
				// inside a sentence), and only its ends carry the brackets.
				if (!s || !/[A-Za-z]/.test(s) || /[[\]~]/.test(el.textContent ?? '') || skip(el)) continue;
				if (!el.getBoundingClientRect().width) continue;
				if (user.test(s) || key.test(s.replace(/\s+/g, ''))) continue;
				plain.push(s.slice(0, 60));
			}
			const clipped: string[] = [];
			for (const el of document.querySelectorAll<HTMLElement>('body *')) {
				if (skip(el) || el.closest('.svelte-flow') || el.children.length) continue;
				const cs = getComputedStyle(el);
				const box = el.getBoundingClientRect();
				if (!box.width || !el.textContent?.trim()) continue;
				const cut = /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis';
				if (cut && el.scrollWidth > el.clientWidth + 1)
					clipped.push(
						`${el.textContent.trim().slice(0, 40)} (${el.scrollWidth} > ${el.clientWidth})`
					);
			}
			return { plain: [...new Set(plain)], clipped };
		},
		[USER_DATA.source, KEY_CAP.source]
	);
}
const clean = { plain: [], clipped: [] };

test('pseudo-locale: every panel speaks through messages and nothing is clipped', async ({
	page
}) => {
	await page.goto('/design/sample?locale=pseudo');
	const canvas = page.locator('.aster-canvas');
	await expect(canvas).toBeFocused();
	await page.keyboard.press('ArrowRight'); // the class inspector, the focus hints
	expect(await audit(page)).toEqual(clean);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await page.keyboard.press('4'); // a relationship: its inspector, and validation warnings
	await page.getByRole('button', { name: /warnings/ }).click();
	expect(await audit(page)).toEqual(clean);
	await page.keyboard.press('ControlOrMeta+k');
	expect(await audit(page)).toEqual(clean);
	await page.keyboard.press('Escape');
	await canvas.focus();
	await page.keyboard.press('?');
	expect(await audit(page)).toEqual(clean);
	await page.keyboard.press('Escape');
	await canvas.focus();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	expect(await audit(page)).toEqual(clean);
});

test('pseudo-locale: Classic and the welcome screen too', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('aster:layout', 'classic'));
	await page.goto('/design/sample?locale=pseudo');
	await expect(page.locator('.aster-canvas')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	expect(await audit(page)).toEqual(clean);
	await page.goto('/?locale=pseudo');
	await page.waitForLoadState('networkidle');
	expect(await audit(page)).toEqual(clean);
});

test('right to left: the chrome mirrors, the paper does not', async ({ page }) => {
	await page.goto('/design/sample?locale=pseudo-rtl');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await expect(page.locator('.aster-canvas')).toBeFocused();
	const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
	const tree = await box('[role=tree]');
	const canvas = await box('.aster-canvas');
	expect(tree.x).toBeGreaterThan(canvas.x); // the Outline is on the right
	// UML coordinates are not mirrored: Account still sits left of Customer.
	const a = await node(page, 'Account').boundingBox();
	const c = await node(page, 'Customer').boundingBox();
	expect(a!.x).toBeLessThan(c!.x);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the language is chosen from the palette and remembered', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Pseudo-locale');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: /^\[Zoom in~+\]$/ })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: /^\[Zoom in~+\]$/ })).toBeVisible();
	// A ?locale in the address wins over the remembered one.
	await page.goto('/design/sample?locale=en');
	await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
});
