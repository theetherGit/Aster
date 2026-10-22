import { defineConfig } from '@playwright/test';

// BASE_URL runs the suite against a deployed site instead of a local build, e.g. the lab
// rehearsal on asteruml.app: BASE_URL=https://asteruml.app pnpm exec playwright test lab.
const deployed = process.env.BASE_URL;

export default defineConfig({
	testDir: 'tests/e2e',
	// Screenshots are compared on macOS (owner) and Linux (CI) against per-platform baselines.
	// CI never writes a missing baseline: record it with the "Linux visual baselines" workflow.
	updateSnapshots: process.env.CI ? 'none' : 'missing',
	// Unhinted text in the test browser, so glyph advances (and so layout) match across platforms.
	use: {
		baseURL: deployed ?? 'http://localhost:4173',
		launchOptions: { args: ['--font-render-hinting=none'] },
		trace: 'retain-on-failure'
	},
	webServer: deployed
		? undefined
		: { command: 'pnpm build && pnpm preview', port: 4173, reuseExistingServer: !process.env.CI }
});
