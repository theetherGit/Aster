import { expect, test, type Download, type Page } from '@playwright/test';
import { canvasOf, node, position } from './helpers';

/**
 * features.md M3.1, Packages with containment: P makes one; a class joins it from the inspector or
 * by being dropped in its frame; moving the package moves what it holds; ⌘⇧N shows "(from …)";
 * the .mdj nests the class in the package's ownedElements, its view in the package's view.
 */
async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}
const pkg = (page: Page, name: string) => page.locator(`.package-node[data-name="${name}"]`);

test('packages: P, joining by inspector and by drop, members move with it, namespace, .mdj nesting', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const box = (await canvasOf(page).boundingBox())!;
	await page.mouse.move(box.x + 120, box.y + box.height - 260);
	await page.keyboard.press('p');
	const name = canvasOf(page).getByRole('textbox', { name: 'Package name' });
	await expect(name).toBeFocused();
	await page.keyboard.type('billing');
	await page.keyboard.press('Enter');
	await expect(pkg(page, 'billing')).toBeVisible();

	// The keyboard path: the inspector's "In package".
	await node(page, 'Account').click();
	await page.getByLabel('In package').click();
	await page.getByRole('option', { name: 'billing' }).click();
	await expect(page.getByLabel('In package')).toContainText('billing');

	// ⌘⇧N: the namespace under the name.
	await canvasOf(page).focus();
	await node(page, 'Account').click();
	await page.keyboard.press('ControlOrMeta+Shift+n');
	await expect(node(page, 'Account')).toContainText('(from billing)');

	// The pointer path: Customer dropped inside the frame joins it. Everything in view first, so
	// the drag never nears an edge (Svelte Flow pans there).
	await page.keyboard.press('ControlOrMeta+9');
	await page.waitForTimeout(400);
	const frame = (await pkg(page, 'billing').boundingBox())!;
	const c = (await node(page, 'Customer').boundingBox())!;
	await page.mouse.move(c.x + 30, c.y + 10);
	await page.mouse.down();
	await page.mouse.move(frame.x + 60, frame.y + 60, { steps: 8 });
	await page.mouse.move(frame.x + 70, frame.y + 70, { steps: 2 });
	await page.mouse.up();
	await node(page, 'Customer').click();
	await expect(page.getByLabel('In package')).toContainText('billing');

	// Moving the package moves both members.
	const before = await position(node(page, 'Account'));
	await pkg(page, 'billing').locator('.tab').click();
	await page.keyboard.press('ControlOrMeta+Shift+ArrowRight');
	await expect.poll(async () => (await position(node(page, 'Account'))).x).toBe(before.x + 8);

	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('tab', { name: 'Project' }).click();
	await sheet.getByRole('radio', { name: '.mdj' }).click();
	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const mdj = JSON.parse(await downloadText(await download));
	const all: Record<string, unknown>[] = [];
	const walk = (v: unknown) => {
		if (Array.isArray(v)) v.forEach(walk);
		else if (v && typeof v === 'object') {
			all.push(v as Record<string, unknown>);
			for (const [k, x] of Object.entries(v)) if (k !== '_parent') walk(x);
		}
	};
	walk(mdj);
	const billing = all.find((o) => o._type === 'UMLPackage' && o.name === 'billing')!;
	const owned = (billing.ownedElements as { name?: string }[]).map((e) => e.name).sort();
	expect(owned).toEqual(['Account', 'Customer']);
	const pkgView = all.find((o) => o._type === 'UMLPackageView')!;
	expect((pkgView.containedViews as unknown[]).length).toBe(2);
});

// Owner's report: auto-layout on the demo left every class outside the "model" frame, and the
// view kept pulling back to the frame while the reader panned away from it.
test('auto-layout keeps classes inside their package, and panning away from a selected frame stays put', async ({
	page
}) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/design/demo');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+k');
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	await palette
		.getByRole('combobox', { name: 'Search commands' })
		.fill('Auto-layout (orthogonal, top to bottom)');
	await page.keyboard.press('Enter');
	await expect(page.getByText(/^Laid out Model\./)).toBeVisible({ timeout: 15_000 });
	await page.keyboard.press('ControlOrMeta+9');
	await page.waitForTimeout(400);

	const frame = (await pkg(page, 'model').boundingBox())!;
	for (const box of await page
		.locator('.classifier-node')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
		expect(box.x).toBeGreaterThanOrEqual(frame.x);
		expect(box.y).toBeGreaterThanOrEqual(frame.y);
		expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
		expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
	}

	// Select the frame, pan well away, then hover a line: the view stays where it was panned.
	await pkg(page, 'model').locator('.tab').click();
	const viewport = page.locator('.svelte-flow__viewport');
	const at = () => viewport.evaluate((el) => (el as HTMLElement).style.transform);
	await page.mouse.move(800, 500);
	await page.mouse.wheel(0, 900);
	await page.waitForTimeout(300);
	const panned = await at();
	const line = page.locator('.uml-edge .edge-hit').first();
	await line.hover({ force: true });
	await page.mouse.move(820, 520);
	await page.waitForTimeout(400);
	expect(await at()).toBe(panned);
});
