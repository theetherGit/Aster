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

export const edgeOf = (page: Page, relId: string) =>
	page.locator(`.uml-edge[data-rel-id="${relId}"]`);

/** Client-space point at a fraction of an edge's drawn length. */
export async function pointOnEdge(edge: Locator, fraction = 0.5) {
	return edge.locator('.edge-line').evaluate((el, f) => {
		const path = el as SVGPathElement;
		const p = path.getPointAtLength(path.getTotalLength() * f);
		const m = path.getScreenCTM()!;
		return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f };
	}, fraction);
}

/** For every edge label, whether any point of its own drawn line falls inside its box. */
export async function labelsOnTheirLine(page: Page) {
	return page.locator('.uml-edge').evaluateAll((edges) =>
		edges.flatMap((g) => {
			const path = g.querySelector('.edge-line') as SVGPathElement;
			const len = path.getTotalLength();
			const pts = Array.from({ length: Math.ceil(len) + 1 }, (_, i) =>
				path.getPointAtLength(Math.min(len, i))
			);
			return [...g.querySelectorAll('.edge-label rect')].map((r) => {
				const b = (r as SVGRectElement).getBBox();
				const hit = pts.some(
					(p) =>
						p.x > b.x + 0.5 &&
						p.x < b.x + b.width - 0.5 &&
						p.y > b.y + 0.5 &&
						p.y < b.y + b.height - 0.5
				);
				return `${g.getAttribute('data-rel-id')}/${r.parentElement!.getAttribute('data-label')}:${hit ? 'ON LINE' : 'clear'}`;
			});
		})
	);
}
