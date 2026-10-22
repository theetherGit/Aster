import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { canvasOf, create, fromPalette, node } from './helpers';

/**
 * Screenshots for the docs site (docs-site/src/assets/shots/), taken from the real app built for
 * the e2e suite, light and dark. Off by default; rerun after a visible UI change:
 *
 *   DOCS_SHOTS=1 pnpm exec playwright test docs-shots
 *
 * The diagram is the docs' own Text view example, pasted into the Text view and laid out, so the
 * pictures show what the docs teach.
 */
test.skip(!process.env.DOCS_SHOTS, 'DOCS_SHOTS=1 takes the docs screenshots');
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

const OUT = new URL('../../docs-site/src/assets/shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const page_ = readFileSync(
	new URL('../../docs-site/src/content/docs/guides/text-view.mdx', import.meta.url),
	'utf8'
);
const EXAMPLE = /## Example[\s\S]*?```text\n([\s\S]*?)```/.exec(page_)![1];

const shot = (
	page: Page,
	name: string,
	clip?: { x: number; y: number; width: number; height: number }
) => page.screenshot({ path: new URL(`${name}.png`, OUT).pathname, clip, animations: 'disabled' });

/** A box around the locators, padded and kept inside the viewport. */
async function around(
	page: Page,
	pad: number,
	...boxes: ({ x: number; y: number; width: number; height: number } | null)[]
) {
	const b = boxes.filter((x): x is NonNullable<typeof x> => !!x);
	const x = Math.max(0, Math.min(...b.map((r) => r.x)) - pad);
	const y = Math.max(0, Math.min(...b.map((r) => r.y)) - pad);
	const vw = page.viewportSize()!;
	const right = Math.min(vw.width, Math.max(...b.map((r) => r.x + r.width)) + pad);
	const bottom = Math.min(vw.height, Math.max(...b.map((r) => r.y + r.height)) + pad);
	return { x, y, width: right - x, height: bottom - y };
}

/** Out of the way: the browser-only banner and any toast. */
async function quiet(page: Page) {
	const banner = page.getByRole('region', { name: 'Not saved to a file' });
	if (await banner.isVisible()) await banner.getByRole('button', { name: 'Dismiss' }).click();
	const toast = page.getByTestId('toast');
	if (await toast.isVisible()) await toast.getByRole('button', { name: 'Dismiss' }).click();
	await expect(toast).toHaveCount(0);
}

/** The library model from the Text view example, laid out top to bottom, fitted, nothing selected. */
async function library(page: Page) {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	await fromPalette(page, 'Text view (PlantUML)');
	const text = page.getByRole('textbox', { name: 'PlantUML text' });
	await expect(text).toBeFocused();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.insertText(EXAMPLE);
	await expect(node(page, 'Library')).toBeVisible();
	await expect(page.getByTestId('text-status')).toContainText('In sync');
	await canvasOf(page).focus();
	await fromPalette(page, 'Auto-layout: Layered, top to bottom');
	await expect(page.getByTestId('toast')).toContainText('Laid out');
	await canvasOf(page).focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+9');
	await quiet(page);
	await page.waitForTimeout(300);
}

for (const scheme of ['light', 'dark'] as const) {
	test.describe(scheme, () => {
		test.use({ colorScheme: scheme });

		test(`welcome, ${scheme}`, async ({ page }) => {
			await page.goto('/');
			await expect(page.getByRole('heading', { name: 'Aster' })).toBeVisible();
			await page.waitForTimeout(300);
			await shot(page, `welcome-${scheme}`);
		});

		test(`editor, text view, export, ${scheme}`, async ({ page }) => {
			await library(page);
			// The hero: a class selected, its properties in the inspector.
			await page.getByRole('tab', { name: 'Properties' }).click();
			await node(page, 'Loan').click({ position: { x: 24, y: 10 } });
			await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Loan');
			await page.waitForTimeout(300);
			await shot(page, `editor-${scheme}`);

			await canvasOf(page).focus();
			await page.keyboard.press('Escape');
			await fromPalette(page, 'Text view (PlantUML)');
			await expect(page.getByTestId('text-status')).toContainText('In sync');
			await shot(page, `text-${scheme}`);

			await canvasOf(page).focus();
			await page.keyboard.press('ControlOrMeta+Shift+e');
			const sheet = page.getByRole('dialog', { name: 'Export diagram' });
			await expect(sheet).toBeVisible();
			await page.waitForTimeout(300);
			await shot(page, `export-${scheme}`, await around(page, 24, await sheet.boundingBox()));
		});

		test(`member chip and kind picker, ${scheme}`, async ({ page }) => {
			await page.goto('/design/new');
			await expect(canvasOf(page)).toBeFocused();
			// No inspector: opening it on selection narrows and shifts the canvas mid-shot.
			await page.keyboard.press('ControlOrMeta+Backslash');
			await page.mouse.move(480, 300);
			await create(page, 'c', 'Account');
			await page.keyboard.type('- balance: float = 0');
			const account = node(page, 'Account');
			const chip = page.locator('.chip');
			await expect(chip).toBeVisible();
			await shot(
				page,
				`chip-${scheme}`,
				await around(page, 32, await account.boundingBox(), await chip.boundingBox())
			);

			await page.keyboard.press('Enter');
			await page.keyboard.press('Escape');
			await page.keyboard.press('Escape');
			await page.mouse.move(760, 300);
			await create(page, 'c', 'Customer');
			await page.keyboard.press('Escape');
			await page.keyboard.press('Escape');
			await quiet(page);
			await node(page, 'Customer').click();
			await page.keyboard.press('l');
			await page.keyboard.press('Enter');
			const picker = page.getByRole('menu', { name: 'Relationship kind' });
			await expect(picker).toBeVisible();
			await page.waitForTimeout(200);
			await shot(
				page,
				`picker-${scheme}`,
				await around(
					page,
					32,
					await account.boundingBox(),
					await node(page, 'Customer').boundingBox(),
					await picker.boundingBox()
				)
			);
		});

		test(`validation, ${scheme}`, async ({ page }) => {
			await library(page);
			await page.mouse.move(1000, 640);
			await create(page, 'c', 'Book');
			await page.keyboard.press('Escape');
			await page.keyboard.press('Escape');
			await quiet(page);
			await fromPalette(page, 'Validation panel');
			const panel = page.getByRole('region', { name: 'Validation' });
			await expect(panel).toContainText('Name is already defined.');
			// Focus on the first finding, as a reader would be, rather than on the canvas.
			await panel
				.getByRole('button', { name: /Name is already defined/ })
				.first()
				.focus();
			await page.waitForTimeout(200);
			await shot(page, `validation-${scheme}`);
		});
	});
}

test('classic layout (always light)', async ({ page }) => {
	await library(page);
	await page.keyboard.press('ControlOrMeta+Shift+l');
	await page.keyboard.press('ControlOrMeta+9');
	await page.waitForTimeout(300);
	await shot(page, 'classic-light');
});

test('high contrast', async ({ page }) => {
	await library(page);
	// System, light, dark, high contrast.
	for (let i = 0; i < 3; i++) await page.keyboard.press('ControlOrMeta+Alt+t');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
	await page.waitForTimeout(300);
	await shot(page, 'contrast-light');
});
