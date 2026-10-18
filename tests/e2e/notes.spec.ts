import { expect, test, type Download } from '@playwright/test';
import { canvasOf, node } from './helpers';

async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

test('notes: N creates one, text commits with ⌘↩, L links it to a class, the inspector unlinks, and both round-trip to .mdj', async ({
	page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
	});
	await page.goto('/');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(700, 500);
	await page.keyboard.press('n');
	const editor = canvasOf(page).getByRole('textbox', { name: 'Note text' });
	await expect(editor).toBeFocused();
	await page.keyboard.type('Overdue after 14 days;');
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('a fine is added each day.');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(editor).toHaveCount(0);
	const note = page.locator('.note-node[data-kind="note"]');
	await expect(note).toHaveCount(1);
	await expect(note).toContainText('Overdue after 14 days;');
	await expect(note).toHaveClass(/selected/);
	await expect(canvasOf(page)).toBeFocused();

	// L from the note: arrows pick a class, Enter links straight away (no kind to pick).
	await page.keyboard.press('l');
	for (let i = 0; i < 6; i++) {
		if (await node(page, 'Customer').evaluate((el) => el.classList.contains('link-target'))) break;
		await page.keyboard.press('ArrowUp');
		await page.waitForTimeout(30);
	}
	await expect(node(page, 'Customer')).toHaveClass(/link-target/);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu', { name: 'Relationship kind' })).toHaveCount(0);
	await expect(page.locator('.note-link')).toHaveCount(1);

	// Board 14: the inspector lists the link and unlinks it.
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	await expect(inspector.getByLabel('Note', { exact: true })).toHaveValue(/Overdue/);
	await expect(inspector).toContainText('Linked to');
	await expect(inspector).toContainText('Customer');
	await inspector.getByRole('button', { name: 'Unlink Customer' }).click();
	await expect(page.locator('.note-link')).toHaveCount(0);
	await expect(inspector).toContainText('Not linked to anything yet.');
	// And links it back from the panel.
	await inspector.getByRole('button', { name: 'Link this note to' }).click();
	await page.getByRole('option', { name: 'Customer' }).click();
	await expect(page.locator('.note-link')).toHaveCount(1);

	// Round trip: UMLNoteView and UMLNoteLinkView in the .mdj export.
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('radio', { name: '.mdj' }).click();
	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const text = await downloadText(await download);
	expect(text).toContain('"_type": "UMLNoteView"');
	expect(text).toContain('"_type": "UMLNoteLinkView"');
	expect(text).toContain('Overdue after 14 days;');
	await page.keyboard.press('Escape');

	// Undo walks it all back to the untouched sample.
	await canvasOf(page).focus();
	const undo = page.getByRole('button', { name: /^Undo/ });
	for (let i = 0; i < 12 && (await undo.isEnabled()); i++) {
		await page.keyboard.press('ControlOrMeta+z');
		await page.waitForTimeout(30);
	}
	await expect(undo).toBeDisabled();
	await expect(page.locator('.note-node')).toHaveCount(0);
});

test('documentation preview renders the Markdown subset', async ({ page }) => {
	await page.goto('/');
	await node(page, 'Customer').click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	const doc = inspector.getByLabel('Documentation', { exact: true });
	await doc.fill('A **customer** of the library.\n\n- borrows\n- returns');
	await doc.press('Tab');
	await inspector.getByRole('button', { name: 'Preview' }).click();
	const preview = inspector.getByTestId('doc-preview');
	await expect(preview.locator('strong')).toHaveText('customer');
	await expect(preview.locator('li')).toHaveCount(2);
});
