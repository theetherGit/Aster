import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Download, type Page } from '@playwright/test';
import { awaitAutosave, canvasOf, create, node } from './helpers';

const fixture = (name: string) =>
	fileURLToPath(new URL(`../../fixtures/mdj/${name}`, import.meta.url));

async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks);
}
async function drop(page: Page, name: string, text: string) {
	const dt = await page.evaluateHandle(
		({ name, text }) => {
			const dt = new DataTransfer();
			dt.items.add(new File([text], name, { type: 'application/json' }));
			return dt;
		},
		{ name, text }
	);
	await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
	await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
}

test.beforeEach(async ({ page }) => {
	// No File System Access: ⌘S downloads (the fallback every browser has).
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
		Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
	});
});

test('autosave: close mid-edit and reopen loses nothing, undo history included', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Book');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Book')).toBeVisible();
	await awaitAutosave(page);
	await page.reload();
	await expect(node(page, 'Book')).toBeVisible();
	await expect(page.getByTestId('footer-save')).toHaveText('not saved to a file yet');
	// The undo stack came back with the project.
	const undo = page.getByRole('button', { name: /^Undo: / });
	await expect(undo).toBeEnabled();
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(node(page, 'Book')).toHaveCount(0);
});

test('⌘S downloads the native .aster for an Aster-born project; the save states follow', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	// Untouched sample: nothing to lose, no dot. The first edit makes it "never saved": amber.
	await expect(page.getByTestId('save-state')).toHaveCount(0);
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Book');
	await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'never');
	await page.keyboard.press('Escape');

	const download = page.waitForEvent('download');
	await page.keyboard.press('ControlOrMeta+s');
	const d = await download;
	expect(d.suggestedFilename()).toBe('library.aster');
	const json = JSON.parse((await downloadText(d)).toString('utf8'));
	expect(json.$schema).toBe('https://asteruml.app/schema/v1.json');
	expect(json.version).toBe(1);
	expect(json.project.name).toBe('Library');
	expect(Object.keys(json.project.elements)).toHaveLength(3); // Account, Customer, Book
	expect(json.origin).toBeUndefined();

	// Saved: no dot, the file name in the footer and the title.
	await expect(page.getByTestId('save-state')).toHaveCount(0);
	await expect(page).toHaveTitle('library.aster – Aster');
	await expect(page.getByTitle('Copy the file name')).toHaveText('library.aster');
	// Unsaved: an edit brings the accent dot and the bullet in the title.
	await page.keyboard.press('Delete');
	await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'unsaved');
	await expect(page).toHaveTitle('library.aster • – Aster');

	// The export sheet's .mdj row is a plain download and leaves the file alone.
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('radio', { name: '.mdj' }).click();
	await expect(sheet.getByTestId('export-name')).toHaveText('library.mdj');
	const mdj = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const mdjJson = JSON.parse((await downloadText(await mdj)).toString('utf8'));
	expect(mdjJson._type).toBe('Project');
	// ⌫ removed Book from the diagram only (keyboard.md): the model still has three classes.
	expect((JSON.stringify(mdjJson).match(/"_type":"UMLClass"/g) ?? []).length).toBe(3);
	await expect(page).toHaveTitle('library.aster • – Aster');
});

test('an .aster file opens by drop and round-trips the project', async ({ page }) => {
	await page.goto('/design/notation');
	await expect(page.locator('.uml-edge')).toHaveCount(8);
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('radio', { name: '.aster' }).click();
	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const text = (await downloadText(await download)).toString('utf8');
	await page.keyboard.press('Escape');

	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await drop(page, 'notation-copy.aster', text);
	await expect(page).toHaveTitle('notation-copy.aster – Aster');
	await expect(page.locator('.classifier-node')).toHaveCount(8);
	await expect(page.locator('.uml-edge')).toHaveCount(8);
	await expect(page.getByTestId('project-name')).toHaveText('UML notation');

	// Strict validation reports the path, not a stack trace (board 22).
	await drop(
		page,
		'bad.aster',
		'{"version":1,"project":{"id":"x","name":"y","elements":{},"diagrams":[],"unknown":[],"importedIds":[],"colour":"red"}}'
	);
	const notice = page.getByTestId('import-notice');
	await expect(notice).toContainText("Couldn't open bad.aster");
	await expect(notice.getByRole('img', { name: /could not be opened/ })).toBeVisible();
	await notice.getByRole('button', { name: 'Show details' }).click();
	await expect(notice).toContainText('$.project.colour: unknown field');
});

test('the opened .mdj wins: the same bytes restore the autosave with its edits, changed bytes parse fresh', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const text = readFileSync(fixture('public-vrview.mdj'), 'utf8');
	await drop(page, 'public-vrview.mdj', text);
	await expect(page.getByTestId('import-notice')).toContainText('Opened public-vrview.mdj');
	await expect(page.locator('.classifier-node')).toHaveCount(2);
	await page.mouse.move(600, 600);
	await create(page, 'c', 'Extra');
	await page.keyboard.press('Escape');
	await awaitAutosave(page);

	// Same bytes again: the prompt (board 20) first, then the autosave comes back, undo included.
	await drop(page, 'public-vrview.mdj', text);
	await page.getByRole('alertdialog').getByRole('button', { name: "Don't save" }).click();
	await expect(page.getByTestId('import-notice')).toContainText(
		'Opened public-vrview.mdj from this browser'
	);
	await expect(node(page, 'Extra')).toBeVisible();
	await expect(page.getByRole('button', { name: /^Undo: / })).toBeEnabled();

	// Changed in StarUML (any byte differs): parsed fresh, the edit is not applied over it.
	await drop(page, 'public-vrview.mdj', text.replace('"name"', '"name" '));
	const dialog = page.getByRole('alertdialog');
	if (await dialog.isVisible()) await dialog.getByRole('button', { name: "Don't save" }).click();
	await expect(page.getByTestId('import-notice')).toContainText('Opened public-vrview.mdj');
	await expect(node(page, 'Extra')).toHaveCount(0);
	await expect(page.locator('.classifier-node')).toHaveCount(2);
});

test('board 20: opening another file over unsaved edits asks first', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const download = page.waitForEvent('download');
	await page.keyboard.press('ControlOrMeta+s');
	await download;
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Book');
	await page.keyboard.press('Escape');

	await drop(page, 'public-vrview.mdj', readFileSync(fixture('public-vrview.mdj'), 'utf8'));
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toContainText('Save changes to library.aster?');
	await expect(dialog).toContainText("You're opening public-vrview.mdj.");
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(node(page, 'Book')).toBeVisible();

	await drop(page, 'public-vrview.mdj', readFileSync(fixture('public-vrview.mdj'), 'utf8'));
	await page.getByRole('alertdialog').getByRole('button', { name: "Don't save" }).click();
	await expect(page).toHaveTitle(/public-vrview\.mdj/);
	await expect(page.locator('.classifier-node')).toHaveCount(2);
});

test('export sheet (board 06): SVG with the font embedded, 2× PNG under 2 MB, copy button', async ({
	page
}) => {
	await page.goto('/design/notation');
	await expect(page.locator('.uml-edge')).toHaveCount(8);
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByTestId('export-name')).toHaveText('library@2x.png');
	await expect(sheet).toContainText(/[\d,]+ × [\d,]+ · ~[\d,.]+ [KM]B/);

	await sheet.getByRole('radio', { name: 'SVG' }).click();
	await expect(sheet.getByTestId('export-name')).toHaveText('library.svg');
	let download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const svg = (await downloadText(await download)).toString('utf8');
	expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
	expect(svg).toContain("@font-face{font-family:'Source Sans 3'");
	expect(svg).toContain('data:font/woff2;base64,');
	expect((svg.match(/<g class="node"/g) ?? []).length).toBe(8);
	expect(svg).not.toContain('<pattern');

	await page.keyboard.press('ControlOrMeta+Shift+e');
	await sheet.getByRole('radio', { name: 'PNG' }).click();
	await sheet.getByRole('radio', { name: '2×' }).click();
	await sheet.getByLabel('Transparent background').check();
	download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const d = await download;
	expect(d.suggestedFilename()).toBe('library@2x.png');
	const png = await downloadText(d);
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	expect(png.length).toBeLessThan(2 * 1024 * 1024);
	// Sharp: the PNG is twice the SVG's size in each direction.
	const width = png.readUInt32BE(16);
	expect(width).toBeGreaterThan(1200);
});

test('⌘N starts an untitled project with an empty class diagram (board 18)', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.getByTestId('project-name').click();
	await page.getByRole('menuitem', { name: 'New diagram' }).click();
	await expect(page.getByTestId('project-name')).toHaveText('Untitled');
	await expect(page.getByRole('tab', { name: 'Class diagram' })).toBeVisible();
	await expect(page.getByText('An empty class diagram')).toBeVisible();
	await expect(page.getByRole('img', { name: /no elements yet/ })).toBeVisible();
	await expect(page.getByTestId('footer-save')).toHaveText('not saved to a file yet');
	await expect(page.getByRole('region', { name: 'Not saved to a file' })).toHaveCount(0); // nothing typed yet
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Thing');
	await page.keyboard.press('Escape');
	await expect(page.getByText('An empty class diagram')).toHaveCount(0);
});

test.describe('the welcome at /', () => {
	test('boards 07 and 23, then the sample with its strip', async ({ page }) => {
		await page.goto('/');
		const welcome = page.getByRole('region', { name: 'Aster' });
		await expect(welcome).toBeVisible();
		await expect(welcome.getByRole('button', { name: /New diagram/ })).toBeVisible();
		await expect(welcome.getByRole('button', { name: /Open file/ })).toBeVisible();
		await expect(welcome.getByRole('button', { name: /New diagram/ })).toBeFocused();
		await expect(welcome).toContainText('Files you open or save appear here');
		await expect(welcome.getByRole('img', { name: 'Sample diagram' })).toBeVisible();
		// Hairline figure at rest, exposed as an image with a meaningful name.
		await expect(welcome.getByRole('img', { name: /nothing open yet/ })).toBeVisible();
		await welcome.getByRole('button', { name: 'Open sample' }).click();
		await expect(page).toHaveURL(/\/design\/sample$/);
		await expect(welcome).toHaveCount(0);
		await expect(page.getByText('Sample. Press ⌘N for your own.')).toBeVisible();
		await expect(node(page, 'Account')).toBeVisible();
		// The first edit names it: the URL follows, and a reload finds it by slug.
		await page.mouse.move(600, 400);
		await create(page, 'c', 'Book');
		await page.keyboard.press('Escape');
		await awaitAutosave(page);
		await expect(page).toHaveURL(/\/design\/library$/);
		await page.reload();
		await expect(node(page, 'Book')).toBeVisible();
		// `new` is never the named project, even when it is the only record.
		await page.goto('/design/new');
		await expect(page.getByText('An empty class diagram')).toBeVisible();
		await page.goto('/design/library');
		await expect(node(page, 'Book')).toBeVisible();
		// Home again: the mark links to the welcome, which lists the project.
		await page.getByRole('link', { name: 'Aster: start page' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('button', { name: /Library/ })).toBeVisible();
	});

	test('/design/new starts empty and stays the draft until named', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /New diagram/ }).click();
		await expect(page).toHaveURL(/\/design\/new$/);
		await expect(page.getByText('An empty class diagram')).toBeVisible();
		await page.mouse.move(600, 400);
		await create(page, 'c', 'Thing');
		await page.keyboard.press('Escape');
		await awaitAutosave(page);
		await expect(page).toHaveURL(/\/design\/new$/);
		await page.reload();
		await expect(node(page, 'Thing')).toBeVisible();
		await expect(page).toHaveURL(/\/design\/new$/);
	});
});
