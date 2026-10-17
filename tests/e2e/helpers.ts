import { expect, type Locator, type Page } from '@playwright/test';

export const canvasOf = (page: Page) => page.getByRole('application', { name: 'Diagram canvas' });
export const node = (page: Page, name: string) =>
	page.locator(`.classifier-node[data-name="${name}"]`);
export const lines = (page: Page, name: string, kind: string) =>
	node(page, name)
		.locator(`[data-compartment="${kind}"] li`)
		.filter({ hasNot: page.locator('input') });

export async function position(n: Locator) {
	const transform = await n.evaluate(
		(el) => (el.closest('.svelte-flow__node') as HTMLElement).style.transform
	);
	const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform)!;
	return { x: Number(m[1]), y: Number(m[2]) };
}

/** Press a create key, wait for the name editor to take focus, type the name and commit it. */
export async function create(page: Page, key: string, name: string) {
	await page.keyboard.press(key);
	const nameBox = canvasOf(page).getByRole('textbox', { name: 'Name' });
	await expect(nameBox).toBeFocused();
	await page.keyboard.type(name);
	await page.keyboard.press('Enter');
}
