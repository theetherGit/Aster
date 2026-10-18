import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	// Screenshots are compared on macOS (owner) and Linux (CI) against per-platform baselines.
	// CI never writes a missing baseline: record it with the "Linux visual baselines" workflow.
	updateSnapshots: process.env.CI ? 'none' : 'missing',
	// Unhinted text in the test browser, so glyph advances (and so layout) match across platforms.
	use: { launchOptions: { args: ['--font-render-hinting=none'] } },
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
