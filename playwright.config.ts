import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	// The notation snapshot is reviewed by eye on the owner's machine (macOS); CI's Linux fonts
	// differ, so CI checks everything except screenshot equality.
	ignoreSnapshots: !!process.env.CI,
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
