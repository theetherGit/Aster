import { readFileSync } from 'node:fs';
import { expect, test, type Download } from '@playwright/test';
import { canvasOf, create, node } from './helpers';

/**
 * features.md M2, Text view: "Edit text → canvas updates; drag on canvas → text updates"; one undo
 * step per parse; errors inline; `.puml` import and export. Board 09.
 */
test('the Text tab shows the diagram as PlantUML and edits apply to the canvas, one undo step each', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	// Nothing selected: the inspector is a rail; the palette's "Text view" opens it on the Text tab.
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Text view');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: 'Text' })).toHaveAttribute('aria-selected', 'true');
	const text = page.getByRole('textbox', { name: 'PlantUML text' });
	await expect(text).toBeFocused();
	await expect(text).toHaveValue(/^@startuml\nabstract class Account <<entity>> \{/);
	const status = page.getByTestId('text-status');
	await expect(status).toContainText('In sync');

	// Type a class at the end: after the pause it is on the canvas.
	// The caret just before @enduml (⌘End is not a text-area key on every platform).
	await text.evaluate((el: HTMLTextAreaElement) => {
		const at = el.value.indexOf('@enduml');
		el.setSelectionRange(at, at);
	});
	await page.keyboard.type('class Shelf {\n  -code: String\n}\n');
	await expect(node(page, 'Shelf')).toBeVisible();
	await expect(status).toContainText('In sync');
	await expect(page.getByTestId('live')).toHaveText('Edit the text view');

	// A missing brace is an error at its line; nothing changes until it is fixed.
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Backspace');
	await expect(status).toContainText('1 error');
	await expect(
		page.getByRole('button', { name: /^Line \d+: missing \} for class Shelf/i })
	).toBeVisible();
	await expect(node(page, 'Shelf')).toBeVisible();
	await page.keyboard.type('}');
	await expect(status).toContainText('In sync');
	await expect(status).toContainText('0 errors');

	// One undo step per parse.
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(node(page, 'Shelf')).toHaveCount(0);
	await expect(text).not.toHaveValue(/Shelf/);

	// The canvas writes back: a class made there appears in the text.
	await page.mouse.move(700, 600);
	await create(page, 'c', 'Branch');
	await page.keyboard.press('Escape');
	await expect(text).toHaveValue(/\nclass Branch\n/);
});

test('.puml exports the diagram and opens as a new project', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const downloading = page.waitForEvent('download');
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('.puml');
	await page.keyboard.press('Enter');
	const download: Download = await downloading;
	expect(download.suggestedFilename()).toBe('main.puml');
	const saved = readFileSync((await download.path())!, 'utf8');
	expect(saved).toMatch(/^@startuml\n/);
	expect(saved).toContain('class Customer {');

	const source =
		'@startuml\nclass Library\nclass Book {\n  -isbn: String\n}\nLibrary *-- Book\n@enduml\n';
	await page.addInitScript((text) => {
		Object.defineProperty(window, 'showOpenFilePicker', {
			configurable: true,
			value: async () => [
				{ kind: 'file', name: 'lab.puml', getFile: async () => new File([text], 'lab.puml') }
			]
		});
	}, source);
	await page.reload();
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+o');
	await expect(page.getByTestId('import-notice')).toContainText('Imported lab.puml');
	await expect(node(page, 'Library')).toBeVisible();
	await expect(node(page, 'Book')).toBeVisible();
	await expect(page.locator('.uml-edge[data-kind="composition"]')).toHaveCount(1);
	await expect(page.getByTestId('project-name')).toHaveText('lab');
});
