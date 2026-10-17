import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
