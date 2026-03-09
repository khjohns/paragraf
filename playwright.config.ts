import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 15000,
	use: {
		baseURL: 'http://localhost:5174',
		screenshot: 'only-on-failure',
	},
	webServer: {
		command: 'npm run dev -- --port 5174',
		port: 5174,
		reuseExistingServer: true,
		timeout: 10000,
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
	],
});
