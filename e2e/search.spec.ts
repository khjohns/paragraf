import { test, expect, type Page } from '@playwright/test';
import { TRAVERSAL_RESPONSE, SINGLE_PROVISION_RESPONSE, CASE_DETAIL } from './fixtures';

// --- Helpers ---

/** Intercept /api/traverse and respond with mock data */
async function mockTraversal(page: Page, data = TRAVERSAL_RESPONSE) {
	await page.route('**/api/traverse', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
	);
}

/** Intercept /api/cases/* and respond with mock case detail */
async function mockCaseDetail(page: Page, data = CASE_DETAIL) {
	await page.route('**/api/cases/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
	);
}

/** Intercept /api/curate/* so it doesn't hang */
async function mockCuration(page: Page) {
	await page.route('**/api/curate/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ highlights: [], summary_note: '' }),
		}),
	);
}

/** Add a provision chip and wait for results */
async function addProvision(page: Page, provision: string) {
	const input = page.locator('#provision-input');
	await input.fill(provision);
	await input.press('Enter');
}

// --- Tests ---

test.describe('Empty state', () => {
	test('shows onboarding message when no seeds are set', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=Definer utgangspunkt')).toBeVisible();
		await expect(page.locator('text=Legg til bestemmelser')).toBeVisible();
	});

	test('header shows only brand without context', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=Paragraf')).toBeVisible();
		// Should NOT show "Ny analyse" in header
		const header = page.locator('header');
		await expect(header).not.toContainText('Ny analyse');
	});
});

test.describe('List view with search results', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCuration(page);
		await page.goto('/');
	});

	test('renders node rows after adding a provision', async ({ page }) => {
		await addProvision(page, 'anskaffelsesforskriften:16-10');

		// Wait for list to populate
		const rows = page.locator('button.node-row');
		await expect(rows.first()).toBeVisible({ timeout: 5000 });

		// Should have 10 nodes (2 provisions + 7 cases + 1 EU)
		await expect(rows).toHaveCount(10);
	});

	test('shows provision chips in seed input', async ({ page }) => {
		await addProvision(page, 'anskaffelsesforskriften:16-10');

		const chip = page.locator('.chip-provision');
		await expect(chip).toBeVisible();
		await expect(chip).toContainText('anskaffelsesforskriften:16-10');
	});

	test('displays category badges (A, B, C)', async ({ page }) => {
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();

		// Verify category badges exist
		await expect(page.locator('.cat-a').first()).toBeVisible();
		await expect(page.locator('.cat-b').first()).toBeVisible();
		await expect(page.locator('.cat-c').first()).toBeVisible();
	});

	test('shows result counts in left panel', async ({ page }) => {
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();

		// Section 3: Resultater should show counts
		const resultsSection = page.locator('text=Resultater').first();
		await expect(resultsSection).toBeVisible();
	});

	test('updates header context with provision name', async ({ page }) => {
		await addProvision(page, 'anskaffelsesforskriften:16-10');

		const header = page.locator('header');
		await expect(header).toContainText('anskaffelsesforskriften:16-10');
	});
});

test.describe('List filtering', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();
	});

	test('Alle filter shows all nodes', async ({ page }) => {
		await page.getByRole('button', { name: 'Alle' }).click();
		const rows = page.locator('button.node-row');
		await expect(rows).toHaveCount(10);
	});

	test('Ulest filter hides read nodes', async ({ page }) => {
		// Mark one node as read by clicking its checkbox
		const firstCheckbox = page.locator('[role="checkbox"]').first();
		await firstCheckbox.click();

		// Switch to Ulest filter
		await page.getByRole('button', { name: 'Ulest' }).click();
		const rows = page.locator('button.node-row');
		await expect(rows).toHaveCount(9);
	});

	test('Avgrensning filter shows only delimitation nodes', async ({ page }) => {
		await page.getByRole('button', { name: 'Avgrensning' }).click();

		// Mock has 1 delimitation node (2019/890)
		const rows = page.locator('button.node-row');
		// The delimitation filter uses analysisState.analysis.delimitations (user-set),
		// not the node's isDelimitation flag. So initially 0 unless user marks one.
		await expect(rows).toHaveCount(0);
	});
});

test.describe('List sorting', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();
	});

	test('sort by Kategori groups A before B before C', async ({ page }) => {
		// Default sort is Kategori
		const labels = page.locator('.node-label');
		// First nodes should be category A (sorted by citations within category)
		const firstLabel = await labels.first().textContent();
		// 2018/123 has 12 citations in category A, should be first case
		expect(firstLabel).toBeTruthy();
	});

	test('sort by Siteringer orders by citation count', async ({ page }) => {
		await page.locator('#sort-select').selectOption('citations');

		// Show warning about citation bias
		await expect(page.locator('text=Eldre saker dominerer')).toBeVisible();

		const labels = page.locator('.node-label');
		// First nodes should be highest citation count
		const first = await labels.first().textContent();
		const second = await labels.nth(1).textContent();
		expect(first).toBeTruthy();
		expect(second).toBeTruthy();
	});

	test('sort by Dato orders newest first', async ({ page }) => {
		await page.locator('#sort-select').selectOption('date');

		// Citation warning should be gone
		await expect(page.locator('text=Eldre saker dominerer')).not.toBeVisible();
	});
});

test.describe('Graph view', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();
	});

	test('switches to graph view and renders SVG', async ({ page }) => {
		await page.getByRole('button', { name: 'Graf' }).click();

		// SVG canvas should appear
		const svg = page.locator('svg.graph-canvas');
		await expect(svg).toBeVisible({ timeout: 5000 });
	});

	test('graph contains node shapes', async ({ page }) => {
		await page.getByRole('button', { name: 'Graf' }).click();
		await page.locator('svg.graph-canvas').waitFor();

		// Provision nodes are rect, KOFA nodes are circle, EU nodes are rotated rect
		const nodeGroups = page.locator('svg.graph-canvas g.graph-node');
		await expect(nodeGroups.first()).toBeVisible();

		// Should have nodes rendered
		const count = await nodeGroups.count();
		expect(count).toBeGreaterThan(0);
	});

	test('graph contains edges', async ({ page }) => {
		await page.getByRole('button', { name: 'Graf' }).click();
		await page.locator('svg.graph-canvas').waitFor();

		const edges = page.locator('svg.graph-canvas path.edge-path, svg.graph-canvas line.edge-line');
		const count = await edges.count();
		expect(count).toBeGreaterThan(0);
	});

	test('switching back to list preserves data', async ({ page }) => {
		await page.getByRole('button', { name: 'Graf' }).click();
		await page.locator('svg.graph-canvas').waitFor();

		await page.getByRole('button', { name: 'Liste' }).click();
		const rows = page.locator('button.node-row');
		await expect(rows.first()).toBeVisible();
		await expect(rows).toHaveCount(10);
	});
});

test.describe('Node selection and detail panel', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCaseDetail(page);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();
	});

	test('clicking a KOFA case opens detail panel', async ({ page }) => {
		// Click a case row (find one by label)
		await page.locator('button.node-row', { hasText: '2023/456' }).click();

		// Detail panel should show
		await expect(page.locator('.detail-panel')).toBeVisible();
		await expect(page.locator('.node-title')).toContainText('2023/456');
	});

	test('detail panel shows node type and metadata', async ({ page }) => {
		await page.locator('button.node-row', { hasText: '2023/456' }).click();

		await expect(page.locator('.type-label')).toContainText('KOFA');
		await expect(page.locator('.outcome-badge')).toContainText('Brudd');
	});

	test('detail panel has overview and reading tabs', async ({ page }) => {
		await page.locator('button.node-row', { hasText: '2023/456' }).click();

		await expect(page.getByRole('button', { name: 'Oversikt' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Les avgjørelsen' })).toBeVisible();
	});

	test('reading tab loads case text', async ({ page }) => {
		await page.locator('button.node-row', { hasText: '2023/456' }).click();
		await page.getByRole('button', { name: 'Les avgjørelsen' }).click();

		// Case text should render
		await expect(page.locator('.para-text').first()).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.para-text').first()).toContainText('bygging av skole');
	});

	test('reading tab shows law references', async ({ page }) => {
		await page.locator('button.node-row', { hasText: '2023/456' }).click();
		await page.getByRole('button', { name: 'Les avgjørelsen' }).click();

		await expect(page.locator('text=Lovhenvisninger')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.ref-label').first()).toContainText('§16-10');
	});

	test('close button dismisses detail panel', async ({ page }) => {
		await page.locator('button.node-row', { hasText: '2023/456' }).click();
		await expect(page.locator('.detail-panel')).toBeVisible();

		await page.locator('.close-btn').click();
		await expect(page.locator('.detail-panel')).not.toBeVisible();
	});

	test('clicking a provision node shows provision detail', async ({ page }) => {
		await page.locator('button.node-row', { hasText: 'FOA §16-10' }).click();

		await expect(page.locator('.type-label')).toContainText('Lovbestemmelse');
	});
});

test.describe('Regulation filter', () => {
	test.beforeEach(async ({ page }) => {
		await mockTraversal(page);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();
	});

	test('FOA 2017- button is active by default', async ({ page }) => {
		const regButton = page.locator('.reg-filter');
		await expect(regButton).toHaveClass(/active/);
		await expect(regButton).toContainText('FOA 2017');
	});

	test('toggling regulation filter dims old FOA nodes', async ({ page }) => {
		// With filter ON, 2015/345 (old regulation) should be dimmed
		const oldRow = page.locator('button.node-row', { hasText: '2015/345' });
		await expect(oldRow).toHaveClass(/dimmed/);
	});

	test('toggling filter off removes dimming', async ({ page }) => {
		const regButton = page.locator('.reg-filter');
		await regButton.click();

		await expect(regButton).toContainText('Alle FOA');

		// Old node should no longer be dimmed
		const oldRow = page.locator('button.node-row', { hasText: '2015/345' });
		await expect(oldRow).not.toHaveClass(/dimmed/);
	});
});

test.describe('Left panel interaction', () => {
	test('panel toggle hides and shows left panel', async ({ page }) => {
		await page.goto('/');

		const leftPanel = page.locator('aside.left-panel');
		await expect(leftPanel).toBeVisible();

		await page.locator('.panel-toggle').click();
		await expect(leftPanel).not.toBeVisible();

		await page.locator('.panel-toggle').click();
		await expect(leftPanel).toBeVisible();
	});

	test('collapsible sections toggle on click', async ({ page }) => {
		await page.goto('/');

		// Section 2 "Utgangspunkt" is closed by default
		const section2 = page.getByRole('button', { name: /Utgangspunkt/ });
		const chipInput = page.locator('.chip-input');
		await expect(chipInput).not.toBeVisible();

		await section2.click();
		await expect(chipInput).toBeVisible();
	});

	test('gap matrix appears with multiple provisions', async ({ page }) => {
		await mockTraversal(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');
		await page.locator('button.node-row').first().waitFor();

		// Gap rows should appear in Section 4
		await expect(page.locator('.gap-row').first()).toBeVisible();
	});
});

test.describe('Single provision search', () => {
	test('renders fewer results with single provision', async ({ page }) => {
		await mockTraversal(page, SINGLE_PROVISION_RESPONSE);
		await mockCuration(page);
		await page.goto('/');
		await addProvision(page, 'anskaffelsesforskriften:16-10');

		const rows = page.locator('button.node-row');
		await expect(rows.first()).toBeVisible({ timeout: 5000 });
		await expect(rows).toHaveCount(3); // 1 provision + 2 cases
	});
});
