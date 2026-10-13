import { expect, test } from './fixtures';

const HEADERS: Record<string, (bytes: number[]) => boolean> = {
    mp4: bytes => String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp',
    webm: bytes => bytes.slice(0, 4).join(',') === [0x1a, 0x45, 0xdf, 0xa3].join(','),
    gif: bytes => String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a',
};

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('record-route')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('seconds').fill('1');
});

for (const format of ['mp4', 'webm', 'gif'] as const) {
    for (const kind of ['route', 'orbit'] as const) {
        test(`records a ${kind} as ${format} and restores the map`, async ({ page }) => {
            const supported = await page.evaluate(f => window.cartelaVideo?.support?.[f] ?? false, format);
            test.skip(!supported, `${format} is not supported by this browser`);
            const before = await page.evaluate(() => {
                const view = window.cartela?.map.getView();
                return { center: view?.getCenter(), rotation: view?.getRotation(), resolution: view?.getResolution() };
            });
            await page.getByTestId('format').selectOption(format);
            await page.getByTestId(`record-${kind}`).click();
            await expect(page.getByTestId('video-status')).toContainText('done', { timeout: 60_000 });
            const head = await page.evaluate(() => window.cartelaVideo?.head() ?? []);
            expect(HEADERS[format]?.(head)).toBe(true);
            const info = await page.evaluate(() => {
                const state = window.cartela;
                const target = state?.map.getTargetElement();
                const view = state?.map.getView();
                return {
                    frames: window.cartelaVideo?.video?.frames,
                    restored: !!target?.querySelector('.ol-viewport') && !(target instanceof HTMLCanvasElement),
                    layers: state?.map.getAllLayers().length,
                    view: { center: view?.getCenter(), rotation: view?.getRotation(), resolution: view?.getResolution() },
                };
            });
            expect(info.frames).toBe(format === 'gif' ? 15 : 30);
            expect(info.restored).toBe(true);
            expect(info.layers).toBe(2);
            expect(info.view).toEqual(before);
            await expect(page.locator('canvas[data-cartela-freeze]')).toHaveCount(0);
        });
    }
}

function topBoxes(bytes: number[]): string[] {
    const boxes: string[] = [];
    let offset = 0;
    while (offset + 8 <= bytes.length && boxes.length < 32) {
        const size = (((bytes[offset] ?? 0) << 24) >>> 0) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
        boxes.push(String.fromCharCode(...bytes.slice(offset + 4, offset + 8)));
        if (size < 8) break;
        offset += size;
    }
    return boxes;
}

for (const format of ['mp4', 'webm', 'gif'] as const) {
    test(`streams ${format} to a writable target`, async ({ page }) => {
        const supported = await page.evaluate(f => window.cartelaVideo?.support?.[f] ?? false, format);
        test.skip(!supported, `${format} is not supported by this browser`);
        const result = await page.evaluate(f => window.cartelaVideo?.streamed(f), format);
        expect(result?.blob).toBe(false);
        expect(result?.closed).toBe(true);
        expect(HEADERS[format]?.(result?.bytes ?? [])).toBe(true);
        if (format === 'mp4') {
            const boxes = topBoxes(result?.bytes ?? []);
            expect(boxes[0]).toBe('ftyp');
            expect(boxes.indexOf('moov')).toBeGreaterThan(0);
            expect(boxes.indexOf('moov')).toBeLessThan(boxes.indexOf('mdat'));
        }
    });
}

test('aborts the target when the recording is cancelled', async ({ page }) => {
    const supported = await page.evaluate(() => window.cartelaVideo?.support?.mp4 ?? false);
    test.skip(!supported, 'mp4 is not supported by this browser');
    const result = await page.evaluate(() => window.cartelaVideo?.streamed('mp4', 0.5));
    expect(result?.aborted).toBe(true);
    expect(result?.closed).toBe(false);
    const layers = await page.evaluate(() => window.cartela?.map.getAllLayers().length);
    expect(layers).toBe(2);
});
