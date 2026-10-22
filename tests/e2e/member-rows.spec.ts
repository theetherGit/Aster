import { expect, test, type Page } from '@playwright/test';
import { lines, node } from './helpers';

/**
 * Board 24 (docs/design/24-member-rows.png), Day 2 prompt item 6: inspector member rows at rest,
 * on hover, while editing and while dragging; reorder through one command by keys, buttons and drag.
 */
const inspectorOf = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });
const attributeRows = (page: Page) =>
	inspectorOf(page).getByRole('list', { name: 'Attributes' }).getByRole('listitem');
const live = (page: Page) => page.getByTestId('live');

async function open(page: Page, name: string) {
	await page.goto('/design/sample');
	await node(page, name).click();
	await expect(inspectorOf(page).getByLabel('Name', { exact: true })).toHaveValue(name);
	// The panel slides in over 160 ms; geometry below needs its final place.
	await expect.poll(async () => (await page.locator('.inspector').boundingBox())?.width).toBe(300);
}

test('rest, hover and editing: 30 px rows, actions beside the text, never over it', async ({
	page
}) => {
	await open(page, 'Account');
	const rows = attributeRows(page);
	await expect(rows).toHaveCount(10);
	const first = rows.first();
	const line = first.getByRole('textbox', { name: 'Attribute line' });

	// Rest: the symbol sits in its own column; the line holds the rest; the title the whole line.
	await page.mouse.move(0, 0);
	expect((await first.boundingBox())!.height).toBe(30);
	await expect(first.locator('[data-vis]')).toHaveText('#');
	await expect(line).toHaveValue('{static} attribute0: String');
	await expect(first).toHaveAttribute('title', '# {static} attribute0: String');
	const rest = (await line.boundingBox())!;

	// Hover: 24 px actions (visibility, remove; no move arrows, owner's request); the text
	// shrinks to make room.
	await first.hover();
	await expect(first.getByRole('button')).toHaveCount(2);
	const actions = [
		first.getByRole('button', { name: /^Visibility of attribute0/ }),
		first.getByRole('button', { name: 'Delete attribute0 from Account' })
	];
	for (const a of actions) {
		const box = (await a.boundingBox())!;
		expect([box.width, box.height]).toEqual([24, 24]);
	}
	const hovered = (await line.boundingBox())!;
	expect(hovered.width).toBeLessThan(rest.width);
	expect(hovered.x + hovered.width).toBeLessThanOrEqual((await actions[0].boundingBox())!.x);

	// Editing: the row tints and shows its keys; the actions step aside.
	await line.click();
	await expect(first).toHaveAttribute('data-editing');
	// The keys are caps (Kbd audit): ↩ on macOS, Enter elsewhere, then Esc.
	const keys = first.locator('kbd[data-slot="kbd"]');
	await expect(keys).toHaveCount(2);
	// A glyph cap carries its spoken name for screen readers: "↩" + "Enter".
	await expect(keys.nth(0)).toContainText(/↩|Enter/);
	await expect(keys.nth(1)).toContainText('Esc');
	await expect(first).toContainText('next');
	await page.keyboard.press('Escape');
	await expect(first).not.toHaveAttribute('data-editing');
	await expect(line).toBeFocused();
	// Esc ended the edit, not the selection.
	await expect(inspectorOf(page).getByLabel('Name', { exact: true })).toHaveValue('Account');
});

test('↩ commits and moves to the next row, appending on the last; Esc reverts', async ({
	page
}) => {
	await open(page, 'Customer');
	const rows = attributeRows(page);
	const first = rows.nth(0).getByRole('textbox');
	await first.fill('{static} id: UUID');
	await first.press('Enter');
	await expect(rows.nth(1).getByRole('textbox')).toBeFocused();
	// The row's visibility went back in front of the typed text.
	await expect(lines(page, 'Customer', 'attribute').first()).toHaveText('# id: UUID');

	await page.keyboard.press('Enter');
	await expect(rows).toHaveCount(3);
	const third = rows.nth(2).getByRole('textbox');
	await expect(third).toBeFocused();
	const before = await third.inputValue();
	await page.keyboard.type('balance: double');
	await page.keyboard.press('Escape');
	await expect(third).toHaveValue(before);
	await expect(third).toBeFocused();
	await expect(lines(page, 'Customer', 'attribute')).toHaveCount(3);
});

test('⌘↑ / ⌘↓ move the row and focus follows; ⌘⇧ jumps to the ends', async ({ page }) => {
	await open(page, 'Account');
	const rows = attributeRows(page);
	const canvasLines = lines(page, 'Account', 'attribute');
	await rows.nth(0).getByRole('textbox').focus();

	await page.keyboard.press('ControlOrMeta+ArrowDown');
	await expect(rows.nth(1).getByRole('textbox')).toBeFocused();
	await expect(rows.nth(1).getByRole('textbox')).toHaveValue('{static} attribute0: String');
	await expect(canvasLines.nth(1)).toContainText('attribute0');
	await expect(live(page)).toHaveText('Moved attribute0 to 2 of 10');

	await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
	await expect(rows.nth(9).getByRole('textbox')).toBeFocused();
	await expect(live(page)).toHaveText('Moved attribute0 to 10 of 10');

	await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
	await expect(rows.nth(0).getByRole('textbox')).toBeFocused();
	await expect(canvasLines.nth(0)).toContainText('attribute0');
	await expect(live(page)).toHaveText('Moved attribute0 to 1 of 10');
});

test('drag by the grip: lifted row, insertion line, origin dimmed; Esc and outside cancel', async ({
	page
}) => {
	await open(page, 'Account');
	const rows = attributeRows(page);
	const inspector = inspectorOf(page);
	const dropLine = inspector.locator('[data-drop-line]');

	async function grab(i: number) {
		await rows.nth(i).hover();
		const g = (await rows.nth(i).locator('[data-grip]').boundingBox())!;
		await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
		await page.mouse.down();
		return g;
	}

	const g = await grab(0);
	const third = (await rows.nth(2).boundingBox())!;
	await page.mouse.move(g.x + 40, third.y + third.height * 0.75, { steps: 6 });
	await expect(dropLine).toBeVisible();
	await expect(inspector.locator('[data-drag-ghost]')).toContainText('attribute0');
	await expect(rows.nth(0)).toHaveCSS('opacity', '0.35');
	await page.mouse.up();
	await expect(rows.nth(2).getByRole('textbox')).toHaveValue('{static} attribute0: String');
	await expect(lines(page, 'Account', 'attribute').nth(2)).toContainText('attribute0');
	await expect(live(page)).toHaveText('Moved attribute0 to 3 of 10');
	await expect(dropLine).toHaveCount(0);

	// Esc cancels and leaves the selection alone.
	const values = () =>
		rows.getByRole('textbox').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
	const order = await values();
	await grab(0);
	const fifth = (await rows.nth(4).boundingBox())!;
	await page.mouse.move(g.x + 40, fifth.y + 4, { steps: 6 });
	await expect(dropLine).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dropLine).toHaveCount(0);
	await page.mouse.up();
	await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Account');
	await expect.poll(values).toEqual(order);

	// Dropped outside the list: nothing moves.
	const list = (await inspector.getByRole('list', { name: 'Attributes' }).boundingBox())!;
	await grab(0);
	await page.mouse.move(list.x - 80, fifth.y + 4, { steps: 6 });
	await expect(dropLine).toHaveCount(0);
	await page.mouse.up();
	await expect.poll(values).toEqual(order);
});

test('visibility from a menu; remove without confirm, with the undo toast', async ({ page }) => {
	await open(page, 'Customer');
	const rows = attributeRows(page);
	await rows.nth(1).hover();
	await rows
		.nth(1)
		.getByRole('button', { name: /^Visibility of attribute1/ })
		.click();
	await expect(page.getByRole('menuitemradio', { name: 'private' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.getByRole('menuitemradio', { name: 'protected' }).click();
	await expect(lines(page, 'Customer', 'attribute').nth(1)).toHaveText('# attribute1: int');
	await expect(rows.nth(1).locator('[data-vis]')).toHaveText('#');

	await rows.nth(0).hover();
	await rows.nth(0).getByRole('button', { name: 'Delete attribute0 from Customer' }).click();
	await expect(rows).toHaveCount(1);
	await expect(page.getByTestId('toast')).toContainText('attribute0 deleted from the model.');
	await page.getByTestId('toast').getByRole('button', { name: /^Undo/ }).click();
	await expect(rows).toHaveCount(2);
});

test('RELATIONSHIPS stays visible with nothing in it', async ({ page }) => {
	await open(page, 'Customer');
	const inspector = inspectorOf(page);
	await expect(inspector.getByRole('heading', { name: 'Relationships' })).toBeVisible();
	await expect(inspector.getByText(/^No relationships\. Press\s*L\s*on the canvas/)).toHaveText(
		'No relationships. Press L on the canvas to link Customer to another class.'
	);
});
