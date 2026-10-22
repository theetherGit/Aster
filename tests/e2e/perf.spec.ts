import { expect, test, type Page } from '@playwright/test';
import { largeMdj } from '../../fixtures/perf/generate.ts';
import { canvasOf } from './helpers';

/**
 * features.md, Performance: a 200-class / 300-edge diagram (M1) and a 500 / 800 one (M3) pan at
 * frame rate, a 10 MB file opens in under 2 s (M3), and first paint stays under budget on a
 * throttled CPU. CI runners vary: the thresholds there are
 * documented baselines, the strict numbers apply on a developer machine.
 */
const CI = !!process.env.CI;

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

/** Drops a generated file, waits until it is open, and returns how long that took. */
async function open(page: Page, classes: number, edges: number) {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const text = JSON.stringify(largeMdj(classes, edges));
	const t0 = Date.now();
	await drop(page, 'large.mdj', text);
	await expect(page.getByTestId('import-notice')).toContainText('Opened large.mdj', {
		timeout: 20_000
	});
	await expect(page.locator('footer')).toContainText(`${classes} classifiers`);
	return { ms: Date.now() - t0, mb: text.length / 1e6 };
}

/** Pans with the middle button for 3 s while a rAF loop records frame times. */
async function pan(page: Page) {
	await page.mouse.move(640, 400);
	await page.evaluate(() => {
		const w = window as unknown as { __frames: number[]; __stop: boolean };
		w.__frames = [];
		w.__stop = false;
		let last = performance.now();
		const tick = (now: number) => {
			w.__frames.push(now - last);
			last = now;
			if (!w.__stop) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	await page.mouse.down({ button: 'middle' });
	const steps = 60;
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(640 - i * 6, 400 - i * 3, { steps: 2 });
		await page.waitForTimeout(50);
	}
	await page.mouse.up({ button: 'middle' });
	const frames = await page.evaluate(() => {
		const w = window as unknown as { __frames: number[]; __stop: boolean };
		w.__stop = true;
		return w.__frames.slice(5);
	});
	const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
	const sorted = [...frames].sort((a, b) => a - b);
	return { frames: frames.length, mean, p95: sorted[Math.floor(sorted.length * 0.95)] };
}

for (const [classes, edges, slice] of [
	[200, 300, 'M1'],
	[500, 800, 'M3']
] as const)
	test(`${classes} classes and ${edges} edges (${slice}): opens, draws, and pans for 3 s under the frame budget`, async ({
		page
	}) => {
		const opened = await open(page, classes, edges);
		// Only what is on screen is rendered (Svelte Flow's onlyRenderVisibleElements above 100 nodes).
		const rendered = await page.locator('.classifier-node').count();
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(classes);
		const { frames, mean, p95 } = await pan(page);
		console.log(
			`perf ${classes}/${edges}: open ${opened.ms} ms, ${frames} frames, mean ${mean.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, ${rendered} nodes rendered`
		);
		// A smooth 60 Hz pan averages one frame (16.7 ms); the budget is no dropped frames, so the
		// mean stays near a frame and the 95th percentile under two.
		expect(mean).toBeLessThan(CI ? 40 : 20);
		expect(p95).toBeLessThan(CI ? 80 : 34);
	});

// features.md M3, Performance: "10 MB .mdj opens in under 2 s". 4,800 classes and 7,600 lines
// in one diagram; the Outline renders only the rows in view.
test('a 10 MB .mdj opens in under 2 s, and the Outline draws only the rows in view', async ({
	page
}) => {
	test.setTimeout(60_000);
	const opened = await open(page, 4800, 7600);
	expect(opened.mb).toBeGreaterThan(10);
	const tree = page.getByRole('tree', { name: 'Model tree' });
	await tree.getByRole('treeitem', { name: /^Large/ }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(tree.getByRole('treeitem', { name: /^Class0\b/ })).toBeVisible();
	const rows = await tree.getByRole('treeitem').count();
	console.log(
		`perf 10 MB: ${opened.mb.toFixed(1)} MB open in ${opened.ms} ms, ${rows} Outline rows in the DOM`
	);
	expect(opened.ms).toBeLessThan(CI ? 6000 : 2000);
	expect(rows).toBeLessThan(200);
	// The keyboard still reaches every row: End lands on the last class, Home on the project.
	await page.keyboard.press('End');
	await expect(tree.getByRole('treeitem', { name: /^Class4799\b/ })).toBeFocused();
	await page.keyboard.press('Home');
	await expect(tree.getByRole('treeitem').first()).toBeFocused();
	expect(await tree.getByRole('treeitem').count()).toBeLessThan(200);
});

test('first paint under 1 s on a 4× throttled CPU', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'CPU throttling is a CDP feature');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const fcp = await page.evaluate(
		() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1
	);
	console.log(`perf: first contentful paint at 4× CPU: ${fcp.toFixed(0)} ms`);
	expect(fcp).toBeGreaterThan(0);
	expect(fcp).toBeLessThan(CI ? 3000 : 1000);
});
