import { expect, test } from '@playwright/test';
import { canvasOf, fromPalette, node } from './helpers';

/**
 * features.md `.mdj` import / export (M3): fragment import, StarUML's File › Import › Fragment.
 * Model only: nothing lands on the open diagram, a diagram inside becomes a tab (owner's ruling).
 */
const ref = (id: string) => ({ $ref: id });
const FRAGMENT = {
	_type: 'UMLPackage',
	_id: 'FragPkg',
	_parent: ref('Elsewhere'),
	name: 'Payments',
	ownedElements: [
		{
			_type: 'UMLClassDiagram',
			_id: 'FragDia',
			_parent: ref('FragPkg'),
			name: 'Payments overview',
			ownedViews: [
				{
					_type: 'UMLClassView',
					_id: 'FragV1',
					_parent: ref('FragDia'),
					model: ref('FragInvoice'),
					left: 40,
					top: 40,
					width: 160,
					height: 80
				}
			]
		},
		{ _type: 'UMLClass', _id: 'FragInvoice', _parent: ref('FragPkg'), name: 'Invoice' },
		{ _type: 'UMLClass', _id: 'FragPayment', _parent: ref('FragPkg'), name: 'Payment' }
	]
};

test('Import fragment… adds the model and its diagram as a tab, one undo step', async ({
	page
}) => {
	// The plain file input path, as in open.spec: Chromium's own picker cannot be driven.
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
	});
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const tabs = page.getByRole('tablist', { name: 'Diagrams' }).getByRole('tab');
	const before = await tabs.count();
	const nodes = await page.locator('.classifier-node').count();

	const chooser = page.waitForEvent('filechooser');
	await fromPalette(page, 'Import fragment…');
	await (
		await chooser
	).setFiles({
		name: 'payments.mfj',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(FRAGMENT))
	});

	const toast = page.getByRole('status').filter({ hasText: 'Imported Payments' });
	await expect(toast).toContainText('Imported Payments: 2 classes, 1 diagram.');
	await expect(tabs).toHaveCount(before + 1);
	await expect(page.getByRole('tab', { name: 'Payments overview' })).toBeVisible();
	// The open diagram is untouched.
	await expect(page.locator('.classifier-node')).toHaveCount(nodes);
	await page.getByRole('tab', { name: 'Payments overview' }).click();
	await expect(node(page, 'Invoice')).toBeVisible();

	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(tabs).toHaveCount(before);
	await expect(page.locator('.classifier-node')).toHaveCount(nodes);
});

test('a file that is not a fragment says so and changes nothing', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
	});
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const chooser = page.waitForEvent('filechooser');
	await fromPalette(page, 'Import fragment…');
	await (
		await chooser
	).setFiles({ name: 'notes.mfj', mimeType: 'application/json', buffer: Buffer.from('hello') });
	await expect(page.getByTestId('import-notice')).toContainText('notes.mfj');
});
