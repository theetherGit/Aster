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
