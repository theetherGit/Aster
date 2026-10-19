import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { parseMdjText } from '../../src/lib/mdj/parse.ts';
import { awaitAutosave, canvasOf, position } from './helpers';

const fixture = (name: string) =>
	fileURLToPath(new URL(`../../fixtures/mdj/${name}`, import.meta.url));
const notice = (page: Page) => page.getByTestId('import-notice');

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

test('⌘O opens a .mdj through the file-input fallback, parsing in a Web Worker', async ({
	page
}) => {
	// Shadow the prototype's method: `delete` on the instance would leave Chromium's in place.
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
	});
	const workers: string[] = [];
	page.on('worker', (w) => workers.push(w.url()));
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();

	const chooser = page.waitForEvent('filechooser');
	await page.keyboard.press('ControlOrMeta+o');
	await (await chooser).setFiles(fixture('public-business-modeling.mdj'));

	await expect(notice(page)).toContainText('Opened public-business-modeling.mdj');
	expect(workers.some((u) => u.includes('parse.worker'))).toBe(true);
	await expect(notice(page)).toHaveAttribute('role', 'status');

	// Diagrams Aster does not show yet are listed, kept for saving back (board 08).
	const kept = notice(page).getByTestId('kept-hidden');
	await expect(kept).toContainText('profile diagram');
	await expect(kept).toContainText('use case diagram');
	await expect(kept).toContainText('are kept and will be saved back unchanged');
	await expect(notice(page)).toContainText(
		'other elements Aster does not draw yet are kept the same way'
	);

	// StarUML’s default diagram is empty here, so the first one with classes opens; every class diagram has a tab.
	await expect(page.getByRole('tab')).toHaveCount(5);
	await expect(page.getByRole('tab', { name: 'Business Goals' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.locator('.classifier-node')).toHaveCount(4);
	await expect(page.getByTestId('project-name')).toHaveText('Business Modeling Example');
	await expect(canvasOf(page)).toBeFocused();

	// The per-diagram detail sits behind a disclosure.
	await notice(page).getByRole('button', { name: 'Details' }).click();
	await expect(notice(page)).toContainText('Business Goals: 4 classifiers, 3 relationships');
	await notice(page).getByRole('button', { name: 'Dismiss' }).click();
	await expect(notice(page)).toHaveCount(0);
});

test('⌘O uses the File System Access picker where it exists', async ({ page }) => {
	const text = readFileSync(fixture('public-vrview.mdj'), 'utf8');
	await page.addInitScript((text) => {
		Object.defineProperty(window, 'showOpenFilePicker', {
			configurable: true,
			value: async () => [
				{ kind: 'file', name: 'picked.mdj', getFile: async () => new File([text], 'picked.mdj') }
			]
		});
	}, text);
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+o');
	await expect(notice(page)).toContainText('Opened picked.mdj');
	await expect(page.locator('.classifier-node')).toHaveCount(2);
});

for (const name of [
	'public-staruml-library.mdj',
	'public-panda.mdj',
	'public-vrview.mdj',
	'public-hydgl.mdj'
]) {
	test(`drop ${name}: every class at its StarUML position, every relationship drawn`, async ({
		page
	}) => {
		const text = readFileSync(fixture(name), 'utf8');
		const { project } = parseMdjText(text);
		const diagram = project.diagrams[0];
		const classes = diagram.elementIds.filter(
			(id) => project.elements.get(id)?.kind === 'classifier'
		);
		const edges = diagram.elementIds.filter((id) => {
			const r = project.elements.get(id);
			return (
				r?.kind === 'relationship' && classes.includes(r.sourceId) && classes.includes(r.targetId)
			);
		});

		await page.goto('/design/sample');
		await expect(canvasOf(page)).toBeFocused();
		await drop(page, name, text);
		await expect(notice(page)).toContainText(`Opened ${name}`);
		await expect(page.locator('.classifier-node')).toHaveCount(classes.length);
		await expect(page.locator('.uml-edge')).toHaveCount(edges.length);

		const source = JSON.parse(text.replace(/^\uFEFF/, ''));
		const views = new Map<string, { left: number; top: number }>();
		const walk = (o: unknown) => {
			if (Array.isArray(o)) o.forEach(walk);
			else if (o && typeof o === 'object') {
				const v = o as Record<string, unknown>;
				if (v._id === diagram.id) {
					for (const view of v.ownedViews as Record<string, unknown>[])
						if (/^UML(Class|Interface|Enumeration|DataType)View$/.test(view._type as string))
							views.set((view.model as { $ref: string }).$ref, {
								left: view.left as number,
								top: view.top as number
							});
				} else Object.entries(v).forEach(([k, x]) => k !== '_parent' && walk(x));
			}
		};
		walk(source);
		expect(views.size).toBe(classes.length);
		for (const [id, { left, top }] of views) {
			const node = page.locator(`.svelte-flow__node[data-id="${id}"] .classifier-node`);
			expect(await position(node), `${id}`).toEqual({ x: left, y: top });
		}
	});
}

test('recent files reopen from the project menu; a file that is not StarUML reports instead of opening', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	for (const name of ['public-vrview.mdj', 'public-twitter-stream.mdj']) {
		await drop(page, name, readFileSync(fixture(name), 'utf8'));
		await expect(notice(page)).toContainText(`Opened ${name}`);
		await awaitAutosave(page);
	}
	// Recents come from autosave; the open project is not listed.
	await page.getByTestId('project-name').click();
	const menu = page.getByRole('menu');
	await expect(menu.getByRole('menuitem')).toHaveText([
		/Rename project…/,
		/New diagram/,
		/Open…/,
		/\bSave (⌘S|Ctrl\+S)$/,
		/Save as…/,
		'public-vrview.mdj'
	]);
	await menu.getByRole('menuitem', { name: 'public-vrview.mdj' }).click();
	await expect(page).toHaveTitle(/public-vrview\.mdj/);
	await expect(page.locator('.classifier-node')).toHaveCount(2);

	await drop(page, 'bad.mdj', '{"_type":"UMLModel"}');
	await expect(notice(page)).toHaveAttribute('role', 'alert');
	await expect(notice(page)).toContainText('Couldn’t open bad.mdj');
	await expect(notice(page)).toContainText(
		'It isn’t a project file Aster can read, so nothing was loaded. Untitled is unchanged.'
	);
	await notice(page).getByRole('button', { name: 'Show details' }).click();
	await expect(notice(page)).toContainText('not a StarUML project');
	await expect(page.locator('.classifier-node')).toHaveCount(2);
});
