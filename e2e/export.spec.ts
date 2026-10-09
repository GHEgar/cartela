import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('guide')).toBeVisible();
});

test('exports a sheet and restores the live map', async ({ page }) => {
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 20_000 });
    const info = await page.evaluate(() => {
        const state = window.cartela;
        const sheet = state?.sheet;
        const target = state?.map.getTargetElement();
        return {
            pages: sheet?.pages.length,
            size: sheet?.geometry.size,
            dpi: sheet?.geometry.dpi,
            frame: sheet ? [sheet.layout.frame.width, sheet.layout.frame.height] : null,
            snapshot: sheet ? [sheet.snapshot.canvas.width, sheet.snapshot.canvas.height] : null,
            attributions: sheet?.snapshot.attributions,
            restored: !!target?.querySelector('.ol-viewport') && !(target instanceof HTMLCanvasElement),
            pixelRatio: state?.map.getPixelRatio(),
        };
    });
    expect(info.pages).toBe(1);
    expect(info.size).toEqual([1650, 1275]);
    expect(info.restored).toBe(true);
    expect(info.pixelRatio).toBe(await page.evaluate(() => window.devicePixelRatio));
    expect(Math.abs((info.snapshot?.[0] ?? 0) - (info.frame?.[0] ?? 0))).toBeLessThanOrEqual(1);
    expect(info.attributions).toContain('Datos sintéticos de cartela');
    await expect(page.locator('canvas[data-cartela-freeze]')).toHaveCount(0);
    expect(await page.evaluate(() => window.cartela?.pdf())).toBe('%PDF-1.4');
});

test('spills a long legend onto extra pages', async ({ page }) => {
    await page.getByTestId('long').check();
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 20_000 });
    const pages = await page.evaluate(() => window.cartela?.sheet?.pages.length ?? 0);
    expect(pages).toBeGreaterThan(1);
    await expect(page.locator('.pages img')).toHaveCount(pages);
});

test('keeps the map centre after exporting', async ({ page }) => {
    const before = await page.evaluate(() => window.cartela?.map.getView().getCenter());
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 20_000 });
    const after = await page.evaluate(() => window.cartela?.map.getView().getCenter());
    expect(after).toEqual(before);
});
