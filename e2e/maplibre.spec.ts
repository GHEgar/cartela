import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
    await page.goto('/maplibre.html');
    await expect(page.getByTestId('guide')).toBeVisible({ timeout: 20_000 });
});

test('exports a MapLibre sheet with pitch and restores the map', async ({ page }) => {
    const before = await page.evaluate(() => window.cartelaMaplibre?.map.getPixelRatio());
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 30_000 });
    const info = await page.evaluate(() => {
        const state = window.cartelaMaplibre;
        const sheet = state?.sheet;
        if (!sheet) return null;
        const { frame } = sheet.layout;
        const ctx = sheet.pages[0]?.getContext('2d');
        const pixels = ctx?.getImageData(Math.round(frame.x), Math.round(frame.y), Math.round(frame.width), Math.round(frame.height)).data ?? [];
        const colours = new Set<number>();
        for (let i = 0; i < pixels.length; i += 4 * 97) colours.add(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0));
        return {
            size: sheet.geometry.size,
            snapshot: [sheet.snapshot.canvas.width, sheet.snapshot.canvas.height],
            frame: [frame.width, frame.height],
            attributions: sheet.snapshot.attributions,
            colours: colours.size,
            pitch: state?.map.getPitch(),
            pixelRatio: state?.map.getPixelRatio(),
        };
    });
    expect(info?.size).toEqual([1650, 1275]);
    expect(Math.abs((info?.snapshot[0] ?? 0) - (info?.frame[0] ?? 0))).toBeLessThanOrEqual(1);
    expect(info?.attributions).toContain('Synthetic data by cartela');
    expect(info?.colours).toBeGreaterThan(4);
    expect(info?.pitch).toBeCloseTo(55);
    expect(info?.pixelRatio).toBe(before);
    await expect(page.locator('canvas[data-cartela-freeze]')).toHaveCount(0);
});

test('exports on the globe', async ({ page }) => {
    await page.getByTestId('globe').check();
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 30_000 });
});

test('records an orbit and puts the bearing back', async ({ page }) => {
    test.setTimeout(240_000);
    const bearing = await page.evaluate(() => window.cartelaMaplibre?.map.getBearing());
    await page.getByTestId('record-orbit').click();
    await expect(page.getByTestId('status')).toContainText('frames', { timeout: 220_000 });
    const info = await page.evaluate(() => ({
        frames: window.cartelaMaplibre?.video?.frames,
        bearing: window.cartelaMaplibre?.map.getBearing(),
    }));
    expect(info.frames).toBeGreaterThan(10);
    expect(info.bearing).toBeCloseTo(bearing ?? 0);
});
