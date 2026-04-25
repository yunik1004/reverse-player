import { test, expect } from '@playwright/test';

test.describe('page load', () => {
  test('renders turntable and URL input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.turntable')).toBeVisible();
    await expect(page.locator('.url-input')).toBeVisible();
    await expect(page.locator('.url-btn')).toBeVisible();
  });

  test('renders platter with grooves and label', async ({ page }) => {
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
});

test.describe('power switch', () => {
  test('toggles motor on click', async ({ page }) => {
    await page.goto('/');
    const pwrButton = page.locator('.power-track');
    await pwrButton.click();
    // Platter should start rotating (transform changes)
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

test.describe('tonearm drag', () => {
  test('tonearm starts at outer edge position', async ({ page }) => {
    await page.goto('/');
    const tonearm = page.locator('.tonearm');
    const style = await tonearm.getAttribute('style');
    // Should have a positive rotation (outer edge angle ~4 degrees)
    const match = style?.match(/rotate\(([\d.]+)deg\)/);
    expect(match).toBeTruthy();
    const angle = parseFloat(match![1]);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(10);
  });

  test('tonearm is draggable', async ({ page }) => {
    await page.goto('/');
    const tonearm = page.locator('.tonearm');
    const box = await tonearm.boundingBox();
    expect(box).toBeTruthy();

    const startStyle = await tonearm.getAttribute('style');

    // Drag tonearm to the left (toward record center)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 50, box!.y + box!.height / 2, { steps: 5 });
    await page.mouse.up();

    const endStyle = await tonearm.getAttribute('style');
    expect(startStyle).not.toBe(endStyle);
  });
});

test.describe('URL input', () => {
  test('accepts text input', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('.url-input');
    await input.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(input).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('LOAD button is clickable', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.url-btn');
    await expect(btn).toBeEnabled();
    await btn.click();
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
    const scale = parseFloat(match![1]);
    expect(scale).toBeLessThan(1);
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
});
