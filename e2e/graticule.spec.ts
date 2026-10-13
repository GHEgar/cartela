import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function exportSheet(page: Page): Promise<void> {
    await page.getByTestId('export').click();
    await expect(page.getByTestId('status')).toContainText('done', { timeout: 30_000 });
}

function cornerSum(page: Page): Promise<number> {
    return page.evaluate(() => {
        const sheet = window.cartela?.sheet;
        const canvas = sheet?.pages[0];
        if (!sheet || !canvas) return -1;
        const { frame } = sheet.layout;
        const mm = (value: number): number => (value * sheet.geometry.dpi) / 25.4;
        const side = Math.round(mm(35));
        const x = Math.round(frame.x + frame.width - mm(3) - side);
        const y = Math.round(frame.y + frame.height - mm(3) - side);
        const data = canvas.getContext('2d')?.getImageData(x, y, side, side).data ?? new Uint8ClampedArray();
        let sum = 0;
        for (let i = 0; i < data.length; i += 97) sum += data[i] ?? 0;
        return sum;
    });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('guide')).toBeVisible();
    await page.getByTestId('layout').selectOption('none');
});

test('draws a UTM graticule and restores the map', async ({ page }) => {
    const before = await page.evaluate(() => window.cartela?.map.getView().getCenter());
    await page.getByTestId('grid').selectOption('utm');
    await exportSheet(page);
    const info = await page.evaluate(() => ({
        layers: window.cartela?.map.getAllLayers().length,
        center: window.cartela?.map.getView().getCenter(),
        reserved: window.cartela?.sheet ? window.cartela.sheet.layout.frame.x - window.cartela.sheet.layout.content.x : 0,
    }));
    expect(info.layers).toBe(2);
    expect(info.center).toEqual(before);
    expect(info.reserved).toBeGreaterThan(0);
});

test('paints an overview map in the corner', async ({ page }) => {
    await page.getByTestId('grid').selectOption('none');
    await exportSheet(page);
    const plain = await cornerSum(page);
    await page.getByTestId('overview').check();
    await exportSheet(page);
    const withOverview = await cornerSum(page);
    expect(plain).toBeGreaterThan(0);
    expect(withOverview).not.toBe(plain);
    await expect(page.locator('canvas[data-cartela-freeze]')).toHaveCount(0);
});
