import { test, expect } from '@playwright/test';

test.describe('page load', () => {
  test('renders turntable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.turntable')).toBeVisible();
  });

  test('renders platter with default label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.platter')).toBeVisible();
    await expect(page.locator('.label-title')).toHaveText('Reverse');
    await expect(page.locator('.label-subtitle')).toHaveText('1999');
  });

  test('renders tonearm', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.tonearm')).toBeVisible();
  });

  test('renders VOL and PWR controls', async ({ page }) => {
    await page.goto('/');
    const labels = page.locator('.control-label');
    await expect(labels.nth(0)).toHaveText('VOL');
    await expect(labels.nth(1)).toHaveText('PWR');
  });

  test('renders mascot button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mascot-btn')).toBeVisible();
  });

  test('renders brand name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-name')).toHaveText('Regulus');
  });
});

test.describe('power switch', () => {
  test('toggles motor on click', async ({ page }) => {
    await page.goto('/');
    const pwrButton = page.locator('.power-track');
    await pwrButton.click();
    const platter = page.locator('.platter');
    const transform1 = await platter.getAttribute('style');
    await page.waitForTimeout(200);
    const transform2 = await platter.getAttribute('style');
    expect(transform1).not.toBe(transform2);
  });

  test('stops platter on second click', async ({ page }) => {
    await page.goto('/');
    const pwrButton = page.locator('.power-track');
    await pwrButton.click();
    await page.waitForTimeout(100);
    await pwrButton.click();
    const platter = page.locator('.platter');
    const transform1 = await platter.getAttribute('style');
    await page.waitForTimeout(200);
    const transform2 = await platter.getAttribute('style');
    expect(transform1).toBe(transform2);
  });
});

test.describe('tonearm', () => {
  test('starts at outer edge position', async ({ page }) => {
    await page.goto('/');
    const tonearm = page.locator('.tonearm');
    const style = await tonearm.getAttribute('style');
    const match = style?.match(/rotate\(([\d.]+)deg\)/);
    expect(match).toBeTruthy();
    const angle = parseFloat(match![1]);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(10);
  });

  test('is draggable', async ({ page }) => {
    await page.goto('/');
    const tonearm = page.locator('.tonearm');
    const box = await tonearm.boundingBox();
    expect(box).toBeTruthy();

    const startStyle = await tonearm.getAttribute('style');

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 50, box!.y + box!.height / 2, { steps: 5 });
    await page.mouse.up();

    const endStyle = await tonearm.getAttribute('style');
    expect(startStyle).not.toBe(endStyle);
  });
});

test.describe('playlist panel', () => {
  test('is hidden by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.playlist-panel')).not.toBeVisible();
  });

  test('opens on mascot click', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    await expect(page.locator('.playlist-panel')).toBeVisible();
  });

  test('closes on close button click', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    await expect(page.locator('.playlist-panel')).toBeVisible();
    await page.locator('.playlist-panel .header-btn:last-child').click();
    await expect(page.locator('.playlist-panel')).not.toBeVisible();
  });

  test('shows tracks with version and name', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    const rows = page.locator('.track-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
    const firstText = await rows.first().locator('.track-name-inner').textContent();
    expect(firstText).toContain('|');
  });

  test('tracks have play buttons', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    const firstRow = page.locator('.track-row').first();
    await expect(firstRow.locator('.track-play')).toBeVisible();
  });

  test('play button highlights active track', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    const firstRow = page.locator('.track-row').first();
    await firstRow.locator('.track-play').click();
    await expect(firstRow).toHaveClass(/active/);
  });

  test('panel stays open after selecting a track', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    await page.locator('.track-play').first().click();
    await expect(page.locator('.playlist-panel')).toBeVisible();
  });

  test('shuffle button exists', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    const shuffleBtn = page.locator('.playlist-panel .header-btn:first-child');
    await expect(shuffleBtn).toBeVisible();
  });
});

test.describe('responsive', () => {
  test('scales down on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('/');
    const wrapper = page.locator('.turntable-wrapper');
    const style = await wrapper.getAttribute('style');
    expect(style).toContain('scale(');
    const match = style?.match(/scale\(([\d.]+)\)/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBeLessThan(1);
  });

  test('no scaling on large viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    const wrapper = page.locator('.turntable-wrapper');
    const style = await wrapper.getAttribute('style');
    const match = style?.match(/scale\(([\d.]+)\)/);
    expect(match).toBeTruthy();
    expect(parseFloat(match![1])).toBe(1);
  });

  test('playlist panel is overlay on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('/');
    await page.locator('.mascot-btn').click();
    const panel = page.locator('.playlist-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThan(10);
  });
});
