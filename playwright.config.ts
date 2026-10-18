import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	// Until the Linux baseline is recorded (workflow "Linux visual baselines"), CI skips screenshot
	// equality; the baselines workflow sets UPDATE_BASELINES to record it.
	ignoreSnapshots: !!process.env.CI && process.env.UPDATE_BASELINES !== '1',
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
