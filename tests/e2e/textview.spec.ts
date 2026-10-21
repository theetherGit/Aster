import { readFileSync } from 'node:fs';
import { expect, test, type Download } from '@playwright/test';
import { canvasOf, create, fromPalette, node } from './helpers';

const inner = { useInnerText: true };

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
	await fromPalette(page, 'Text view');
	await expect(page.getByRole('tab', { name: 'Text' })).toHaveAttribute('aria-selected', 'true');
	const text = page.getByRole('textbox', { name: 'PlantUML text' });
	await expect(text).toBeFocused();
	// CodeMirror's editor is a contenteditable: its lines read as innerText.
	await expect(text).toHaveText(/^@startuml\nabstract class Account <<entity>> \{/, inner);
	const status = page.getByTestId('text-status');
	await expect(status).toContainText('In sync');

	// Type a class at the end: after the pause it is on the canvas. The caret just before @enduml.
	await page.locator('.cm-line', { hasText: /^@enduml$/ }).click();
	await page.keyboard.press('Home');
	await page.keyboard.type('class Shelf {\n  -code: String\n}\n');
	await expect(node(page, 'Shelf')).toBeVisible();
	await expect(status).toContainText('In sync');
	await expect(page.getByTestId('live')).toHaveText('Edit the text view');

	// A missing brace is an error at its line; nothing changes until it is fixed.
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Backspace');
	await expect(status).toContainText('1 error');
	// Inline as well: the line is underlined and marked in the gutter.
	await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
	await expect(page.locator('.cm-lint-marker-error')).toHaveCount(1);
	await expect(
		page.getByRole('button', { name: /^Line \d+: missing \} for class Shelf/i })
	).toBeVisible();
	await expect(node(page, 'Shelf')).toBeVisible();
	await page.keyboard.type('}');
	await expect(status).toContainText('In sync');
	await expect(status).toContainText('0 errors');
	await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);

	// One undo step per parse.
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(node(page, 'Shelf')).toHaveCount(0);
	await expect(text).not.toHaveText(/Shelf/, inner);

	// The canvas writes back: a class made there appears in the text.
	await page.mouse.move(700, 600);
	await create(page, 'c', 'Branch');
	await page.keyboard.press('Escape');
	await expect(text).toHaveText(/\nclass Branch\n/, inner);
});

test('.puml exports the diagram and opens as a new project', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const downloading = page.waitForEvent('download');
	await fromPalette(page, '.puml');
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

/** Owner's report, 2026-10-19: choosing Properties with nothing selected closed the inspector. */
test('Properties chosen with nothing selected stays open and says so', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await fromPalette(page, 'Text view');
	await page.getByRole('tab', { name: 'Properties' }).click();
	await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText(
		'Nothing selected'
	);
	// Selecting, then clearing the selection, still folds it to its rail (ui.md).
	await canvasOf(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('complementary', { name: 'Inspector' })).not.toContainText(
		'Nothing selected'
	);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Show inspector' })).toBeVisible();
});

/** Owner's request, 2026-10-19: the Text tab resizes, and its PlantUML is coloured. */
test('the Text tab resizes by keyboard and pointer, remembers its width, and colours keywords', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await fromPalette(page, 'Text view');
	const panel = page.getByRole('complementary', { name: 'Inspector' });
	const handle = page.getByRole('slider', { name: 'Resize the inspector' });
	await expect(handle).toHaveValue('360');
	const width = async () => Math.round((await panel.boundingBox())!.width);
	expect(await width()).toBe(360);
	await handle.focus();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(handle).toHaveValue('392');
	expect(await width()).toBe(392);
	// Drag the strip 100 px further out, once the panel has finished sliding in.
	const strip = page.getByTestId('inspector-resize');
	await expect.poll(async () => (await strip.boundingBox())!.x).toBe(1280 - 392 - 6);
	const box = (await strip.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(handle).toHaveValue('488'); // 392 + 100, on the 16 px grid
	await page.reload();
	// The app must have booted before ⌘K means anything (CI is slower than a laptop).
	await expect(canvasOf(page)).toBeFocused();
	await fromPalette(page, 'Text view');
	await expect(page.getByRole('slider', { name: 'Resize the inspector' })).toHaveValue('488');
	// The colouring: keywords are their own spans, behind the text area.
	await expect(page.locator('.tk-keyword').first()).toHaveText('abstract');
	await expect(page.locator('.tk-directive').first()).toHaveText('@startuml');
});

/** Owner's report, 2026-10-19: PlantUML import and export had no visible home. */
test('PlantUML import and export are in the project menu and on the Text tab', async ({ page }) => {
	const source = '@startuml\nclass Shelf {\n  -code: String\n}\n@enduml\n';
	await page.addInitScript((text) => {
		Object.defineProperty(window, 'showOpenFilePicker', {
			configurable: true,
			value: async () => [
				{ kind: 'file', name: 'shelf.puml', getFile: async () => new File([text], 'shelf.puml') }
			]
		});
	}, source);
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.getByTestId('project-menu').click();
	await expect(
		page.getByRole('menuitem', { name: /^Import PlantUML as a new project/ })
	).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: /^Export the diagram as PlantUML/ })
	).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('project-menu')).toBeFocused(); // the menu has handed focus back
	await canvasOf(page).focus(); // and the diagram has the keyboard before the palette opens

	// On the Text tab: Import loads a file into this diagram, one undo step.
	await fromPalette(page, 'Text view');
	await page.getByRole('button', { name: 'Import .puml into this diagram' }).click();
	await expect(node(page, 'Shelf')).toBeVisible();
	await expect(node(page, 'Account')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'PlantUML text' })).toHaveText(
		/class Shelf/,
		inner
	);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(node(page, 'Account')).toBeVisible();
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export .puml' }).click();
	expect((await downloading).suggestedFilename()).toBe('main.puml');
});

/** keyboard.md ⌘F, "Find in text view"; the editor never traps Tab (accessibility.md). */
test('⌘F finds in the text, its panel is keyboard-sized, and Tab leaves the editor', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await fromPalette(page, 'Text view');
	const text = page.getByRole('textbox', { name: 'PlantUML text' });
	await expect(text).toBeFocused();
	await page.keyboard.press('ControlOrMeta+f');
	const find = page.getByRole('textbox', { name: 'Find' });
	await expect(find).toBeFocused();
	await page.keyboard.type('Customer');
	await page.keyboard.press('Enter');
	await expect(page.locator('.cm-searchMatch-selected')).toHaveText('Customer');
	// Every control in the panel is at least 24 × 24 (CLAUDE.md rule 4).
	const small = await page.locator('.cm-search').evaluate((panel) =>
		[...panel.querySelectorAll('input:not([type=checkbox]), button')]
			.map((el) => el.getBoundingClientRect())
			.filter((r) => r.height < 23.5)
			.map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`)
	);
	expect(small).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(page.locator('.cm-search')).toHaveCount(0);
	await expect(text).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(text).not.toBeFocused();
});
