import { expect, test, type Download } from '@playwright/test';
import { awaitAutosave, canvasOf, create, node } from './helpers';

/**
 * features.md M3, PWA: "Airplane-mode session opens, edits, saves, exports". One visit online
 * installs the service worker (src/service-worker/index.ts); then, with the network off, the
 * welcome page opens a recent project, a class is added, ⌘S saves it in the browser, and the
 * diagram exports as PNG and as PDF, whose WASM engine came from the cache too.
 */
async function bytes(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks);
}

test('airplane mode: a recent project opens, edits, saves and exports PNG and PDF', async ({
	page,
	context
}) => {
	// Online: the first visit installs the worker; the editor makes a project to come back to.
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(520, 320);
	await create(page, 'c', 'Book');
	await page.keyboard.press('Escape');
	await awaitAutosave(page);
	await page.goto('/');
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Aster', level: 1 })).toBeVisible();

	// Open it from Recent, offline.
	await page.locator('.recent .row').first().click();
	await expect(node(page, 'Book')).toBeVisible();

	// Edit.
	await canvasOf(page).focus();
	await page.mouse.move(820, 320);
	await create(page, 'c', 'Loan');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Loan')).toBeVisible();

	// Save: the browser copy, no network needed.
	await page.keyboard.press('ControlOrMeta+s');
	await expect(page.getByTestId('toast')).toContainText('Saved in this browser only.');

	// Export a PNG, then a PDF (its WASM engine loads from the cache).
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('tab', { name: 'Image' }).click();
	let download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	expect((await bytes(await download)).subarray(1, 4).toString()).toBe('PNG');

	await sheet.getByRole('tab', { name: 'PDF' }).click();
	download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	expect((await bytes(await download)).subarray(0, 5).toString()).toBe('%PDF-');

	// The docs are another Worker's: offline, /docs fails rather than showing the app's shell.
	await expect(page.goto('/docs/')).rejects.toThrow();

	await context.setOffline(false);
});
