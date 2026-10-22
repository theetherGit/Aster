import { expect, test, type Download, type Page } from '@playwright/test';
import { canvasOf } from './helpers';

/**
 * features.md M3.2, Object diagrams: "An object diagram references classes from the class diagram
 * and exports to UMLObjectDiagram". Keyboard only: the palette adds the diagram and the objects,
 * the object editor takes "name: Class" and its slots, L and ↩ link two objects.
 */
async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}
async function palette(page: Page, query: string) {
	await page.keyboard.press('ControlOrMeta+k');
	const dialog = page.getByRole('dialog', { name: 'Command palette' });
	await dialog.getByRole('combobox', { name: 'Search commands' }).fill(query);
	await expect(dialog.getByRole('option').first()).toContainText(query, { ignoreCase: true });
	await page.keyboard.press('Enter');
	await expect(dialog).toHaveCount(0);
}
const object = (page: Page, name: string) => page.locator(`.instance-node[data-name="${name}"]`);

test('object diagram: objects of the sample classes, a slot, a link, and UMLObjectDiagram on export', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await palette(page, 'Add object diagram');
	await expect(canvasOf(page)).toHaveAccessibleName(/Object diagram/);
	await expect(page.getByRole('radio', { name: 'Object' })).toBeVisible();

	const editor = canvasOf(page).getByRole('textbox', { name: /^Object:/ });
	await palette(page, 'New object');
	await expect(editor).toBeFocused();
	await page.keyboard.type('acc: Account\nbalance = 100');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(object(page, 'acc')).toContainText('acc: Account');
	await expect(object(page, 'acc')).toContainText('balance = 100');

	await palette(page, 'New object');
	await expect(editor).toBeFocused();
	await page.keyboard.type('ann: Customer');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(object(page, 'ann')).toContainText('ann: Customer');

	// ann is selected; L picks the nearest object, ↩ makes the link with no kind to choose.
	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await expect(page.locator('.uml-edge')).toHaveCount(1);
	await expect(page.getByRole('dialog', { name: /relationship/i })).toHaveCount(0);

	// The inspector names the class from the class diagram's list.
	await object(page, 'acc').click();
	await expect(page.getByLabel('Class')).toContainText('Account');

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
	const of = (type: string) => all.filter((o) => o._type === type);
	expect(of('UMLObjectDiagram')).toHaveLength(1);
	const account = of('UMLClass').find((c) => c.name === 'Account')!;
	const acc = of('UMLObject').find((o) => o.name === 'acc')!;
	// The object references the class from the class diagram, by $ref.
	expect(acc.classifier).toEqual({ $ref: account._id });
	expect(of('UMLSlot').map((s) => [s.name, s.value])).toEqual([['balance', '100']]);
	expect(of('UMLLink')).toHaveLength(1);
	expect(of('UMLObjectView')).toHaveLength(2);
	expect(of('UMLLinkView')).toHaveLength(1);
});
