import { expect, test, type Page } from '@playwright/test';
import { largeMdj } from '../../fixtures/perf/generate.ts';
import { canvasOf } from './helpers';

/**
 * features.md, Performance (M1 slice): a 200-class / 300-edge diagram pans at frame rate, and
 * first paint stays under budget on a throttled CPU. CI runners vary: the thresholds there are
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

test('200 classes and 300 edges: opens, draws, and pans for 3 s under the frame budget', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const t0 = Date.now();
	await drop(page, 'large.mdj', JSON.stringify(largeMdj()));
	await expect(page.getByTestId('import-notice')).toContainText('Opened large.mdj');
	await expect(page.locator('footer')).toContainText('200 classifiers');
	const openMs = Date.now() - t0;

	// Only what is on screen is rendered (Svelte Flow's onlyRenderVisibleElements above 100 nodes).
	const rendered = await page.locator('.classifier-node').count();
	expect(rendered).toBeGreaterThan(0);
	expect(rendered).toBeLessThan(200);

	// Pan with the middle button for 3 s while a rAF loop records frame times.
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
	const p95 = sorted[Math.floor(sorted.length * 0.95)];
	console.log(
		`perf: open ${openMs} ms, ${frames.length} frames, mean ${mean.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, ${rendered} nodes rendered`
	);
	// A smooth 60 Hz pan averages one frame (16.7 ms); the budget is no dropped frames, so the
	// mean stays near a frame and the 95th percentile under two.
	expect(mean).toBeLessThan(CI ? 40 : 20);
	expect(p95).toBeLessThan(CI ? 80 : 34);
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
