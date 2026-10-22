import { expect, test, type Download } from '@playwright/test';
import { canvasOf } from './helpers';

/**
 * M3.4 prompt: Mermaid export, in the one export sheet with tabs rather than separate dialogs.
 * The Text tab shows what it will write, copies it and downloads it.
 */
async function downloadBytes(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks);
}
async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

test('the Text tab previews, copies and downloads Mermaid and PlantUML', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/design/notation');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	// Opens on its tabs, focus on the open one.
	await expect(sheet.getByRole('tab', { name: 'Image' })).toBeFocused();
	await expect(sheet.getByRole('tab', { name: 'Image' })).toHaveAttribute('aria-selected', 'true');

	await sheet.getByRole('tab', { name: 'Text' }).click();
	const preview = sheet.getByTestId('export-text');
	await expect(preview).toContainText('classDiagram');
	await expect(preview).toContainText('Book "0..* books" --* "1" Library');
	await expect(sheet.getByTestId('export-name')).toHaveText('library.mmd');
	await expect(sheet).toContainText(/\d+ lines · ~\d+ KB/);

	await sheet.getByRole('button', { name: 'Copy text' }).click();
	await expect(sheet.getByTestId('export-copy-status')).toHaveText('Copied');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Member --|> Person');

	let download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	let d = await download;
	expect(d.suggestedFilename()).toBe('library.mmd');
	expect(await downloadText(d)).toMatch(/^---\ntitle: Library\n---\nclassDiagram\n/);

	await page.keyboard.press('ControlOrMeta+Shift+e');
	await sheet.getByRole('radio', { name: 'PlantUML' }).click();
	await expect(preview).toContainText('@startuml');
	download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	d = await download;
	expect(d.suggestedFilename()).toBe('library.puml');
	expect(await downloadText(d)).toContain('@enduml');

	// Each tab keeps its own choice: back on Image it is still PNG.
	await page.keyboard.press('ControlOrMeta+Shift+e');
	await sheet.getByRole('tab', { name: 'Image' }).click();
	await expect(sheet.getByTestId('export-name')).toHaveText('library@2x.png');
	await sheet.getByRole('tab', { name: 'Text' }).click();
	await expect(sheet.getByRole('radio', { name: 'PlantUML' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('the PDF tab downloads one vector page of the size and orientation chosen', async ({
	page
}) => {
	await page.goto('/design/notation');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('tab', { name: 'PDF' }).click();
	await expect(sheet.getByTestId('export-name')).toHaveText('library.pdf');
	// Auto turns the page to the diagram, which is wider than tall.
	await expect(sheet.getByTestId('export-page')).toHaveText(/^A4 landscape · \d+%$/);
	await sheet.getByRole('radio', { name: 'A3' }).click();
	await sheet.getByRole('radio', { name: 'Portrait' }).click();
	await expect(sheet.getByTestId('export-page')).toHaveText(/^A3 portrait · \d+%$/);
	// Image-only controls are not on this tab.
	await expect(sheet.getByRole('button', { name: 'Copy to clipboard' })).toHaveCount(0);

	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const d = await download;
	expect(d.suggestedFilename()).toBe('library.pdf');
	const pdf = (await downloadBytes(d)).toString('latin1');
	expect(pdf.startsWith('%PDF-')).toBe(true);
	// A3 portrait in points, and no raster image anywhere: vector.
	expect(pdf).toMatch(/\/MediaBox\s*\[0 0 841\.8\d* 1190\.5\d*\]/);
	expect(pdf).not.toMatch(/\/Subtype\s*\/Image/);
});
