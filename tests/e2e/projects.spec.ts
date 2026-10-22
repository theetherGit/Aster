import { expect, test, type Download, type Page } from '@playwright/test';
import { canvasOf, node } from './helpers';

/**
 * Owner's request (2026-10-22): every project the browser keeps, past Recent's ten, can be seen,
 * opened (by the page or its address), downloaded and deleted.
 */
async function text(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}
/** Open a bundled project, add a class, and wait for the save that names it. */
async function keep(page: Page, route: string, slug: string) {
	await page.goto(`/design/${route}`);
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(700, 600);
	await page.keyboard.press('c');
	await expect(canvasOf(page).getByRole('textbox', { name: 'Name' })).toBeFocused();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(page.getByText('Saved in this browser only.')).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/design/${slug}$`));
}

test('all projects: one fallen off Recent is listed, opens by its address, downloads, and deletes', async ({
	page
}) => {
	await keep(page, 'demo', 'aster');
	await keep(page, 'sample', 'library');
	// As if Aster had fallen off Recent's ten: its record stays, the list forgets it.
	await page.evaluate(
		() =>
			new Promise<void>((done, fail) => {
				const open = indexedDB.open('keyval-store');
				open.onerror = () => fail(open.error);
				open.onsuccess = () => {
					const store = open.result.transaction('keyval', 'readwrite').objectStore('keyval');
					const get = store.get('aster:recent');
					get.onsuccess = () => {
						const recent = (get.result as { name: string }[]).filter((r) => r.name !== 'Aster');
						store.put(recent, 'aster:recent').onsuccess = () => done();
					};
				};
			})
	);

	await page.goto('/');
	const welcome = page.getByRole('region', { name: 'Aster' });
	await expect(welcome.locator('.recent .row')).toHaveCount(1);
	await welcome.getByRole('link', { name: 'View all' }).click();
	await expect(page).toHaveURL(/\/projects$/);
	const list = page.getByRole('list', { name: 'Projects' });
	await expect(list.getByRole('listitem')).toHaveCount(2);
	await expect(list.getByRole('listitem').filter({ hasText: 'Aster' })).toContainText(
		'not in Recent'
	);

	// Its address still finds it.
	await page.goto('/design/aster');
	await expect(node(page, 'Project')).toBeVisible();

	// Download writes the project's own format, named after it.
	await page.goto('/projects');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download Library' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('Library.aster');
	expect(JSON.parse(await text(file)).project.name).toBe('Library');

	// Delete asks first; focus stays in the list.
	await page.getByRole('button', { name: 'Delete Library' }).click();
	const ask = page.getByRole('alertdialog', { name: 'Delete Library?' });
	await expect(ask).toContainText('gone for good');
	await ask.getByRole('button', { name: 'Delete' }).click();
	await expect(list.getByRole('listitem')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Open Aster' })).toBeFocused();

	// Open from the page.
	await page.getByRole('button', { name: 'Open Aster' }).click();
	await expect(page).toHaveURL(/\/design\/aster$/);
	await expect(node(page, 'Project')).toBeVisible();
});
