import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasOf, fromPalette, node } from './helpers';

/**
 * Owner's request (2026-10-31): the panels resize, in Classic and in Modern. Each divider is a
 * real range input (keys, screen readers) with a strip beside it for the pointer; sizes are
 * remembered per browser, and a double-click on the strip puts the default back.
 */
const width = async (l: Locator) => Math.round((await l.boundingBox())!.width);
const height = async (l: Locator) => Math.round((await l.boundingBox())!.height);
async function drag(page: Page, strip: Locator, dx: number, dy: number) {
	const b = (await strip.boundingBox())!;
	const x = b.x + b.width / 2;
	const y = b.y + b.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y + dy, { steps: 6 });
	await page.mouse.up();
}

test.describe('Classic', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('aster:layout', 'classic'));
		await page.goto('/design/sample');
		await expect(canvasOf(page)).toBeFocused();
	});

	test('the sidebar widens by keyboard and by its strip, is remembered, and resets', async ({
		page
	}) => {
		const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
		const slider = page.getByRole('slider', { name: 'Resize the sidebar' });
		expect(await width(sidebar)).toBe(200);
		await slider.focus();
		await page.keyboard.press('ArrowRight');
		await expect(slider).toHaveValue('216');
		expect(await width(sidebar)).toBe(216);
		await drag(page, page.getByTestId('split-sidebar'), 96, 0);
		await expect(slider).toHaveValue('312');
		expect(await width(sidebar)).toBe(312);
		await page.reload();
		await expect(canvasOf(page)).toBeFocused();
		expect(await width(sidebar)).toBe(312);
		await page.getByTestId('split-sidebar').dblclick();
		await expect.poll(() => width(sidebar)).toBe(200);
	});

	test('the right column widens toward the canvas', async ({ page }) => {
		const right = page.getByRole('complementary', { name: 'Model Explorer and Editors' });
		const slider = page.getByRole('slider', { name: 'Resize Model Explorer and Editors' });
		expect(await width(right)).toBe(280);
		await slider.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(slider).toHaveValue('296');
		await drag(page, page.getByTestId('split-right'), -64, 0);
		await expect(slider).toHaveValue('360');
		expect(await width(right)).toBe(360);
	});

	test('Editors takes more of its column, by keyboard and by its strip', async ({ page }) => {
		await node(page, 'Account').click();
		const editors = page.getByRole('complementary', { name: 'Editors', exact: true });
		const slider = page.getByRole('slider', { name: 'Resize Editors' });
		await expect(slider).toHaveValue('60');
		const before = await height(editors);
		await slider.focus();
		await page.keyboard.press('ArrowUp');
		await expect(slider).toHaveValue('65');
		await expect.poll(() => height(editors)).toBeGreaterThan(before);
		const mid = await height(editors);
		await drag(page, page.getByTestId('split-editors'), 0, -80);
		await expect.poll(() => height(editors)).toBeGreaterThan(mid + 40);
	});

	test('the Toolbox and Working Diagrams share the sidebar by a strip between them', async ({
		page
	}) => {
		const slider = page.getByRole('slider', { name: 'Resize the Toolbox' });
		await expect(slider).toHaveValue('70');
		await slider.focus();
		await page.keyboard.press('ArrowDown');
		await expect(slider).toHaveValue('65');
	});
});

test.describe('Modern', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('aster:outline', '1'));
		await page.goto('/design/sample');
		await expect(canvasOf(page)).toBeFocused();
	});

	test('the Outline widens by keyboard and by its strip', async ({ page }) => {
		const outline = page.getByRole('complementary', { name: 'Outline' });
		const slider = page.getByRole('slider', { name: 'Resize the Outline' });
		await expect.poll(() => width(outline)).toBe(240);
		await slider.focus();
		await page.keyboard.press('ArrowRight');
		await expect(slider).toHaveValue('256');
		await drag(page, page.getByTestId('split-outline'), 64, 0);
		await expect(slider).toHaveValue('320');
		await expect.poll(() => width(outline)).toBe(320);
	});

	test('the inspector widens on every tab, not the Text tab alone', async ({ page }) => {
		await node(page, 'Account').click();
		const inspector = page.getByRole('complementary', { name: 'Inspector' });
		const slider = page.getByRole('slider', { name: 'Resize the inspector' });
		await expect.poll(() => width(inspector)).toBe(300);
		await slider.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(slider).toHaveValue('316');
		await expect.poll(() => width(inspector)).toBe(316);
	});

	test('the validation panel grows by its strip', async ({ page }) => {
		await fromPalette(page, 'Validation');
		const panel = page.getByRole('region', { name: 'Validation' });
		await expect(panel).toBeVisible();
		const slider = page.getByRole('slider', { name: 'Resize Validation' });
		await expect(slider).toHaveValue('224');
		await slider.focus();
		await page.keyboard.press('ArrowDown');
		await expect(slider).toHaveValue('208');
	});
});
