# cartela

Headless print and video export for [OpenLayers](https://openlayers.org) maps. cartela renders the map
straight into a canvas sized for paper and DPI, composes a sheet around it — title, legend, scale bar,
north arrow, coordinate grid, attributions — and hands you PNG, JPEG, WebP or PDF. It also records the
map frame by frame along a route or around a centre and hands you MP4, WebM or GIF. It ships no CSS,
no brand and no UI: you build the dialog, cartela builds the sheet.

```bash
npm install cartela ol
```

```ts
import { exportMap, toPdf, saveBlob, title, legend, scaleBar, northArrow, graticule, overviewMap, attribution, wmsLegends } from 'cartela';

const sheet = await exportMap(map, {
    page: { size: 'letter', orientation: 'landscape', dpi: 200 },
    layout: 'right',
    elements: [
        title('Population 2020'),
        legend(wmsLegends(map), { title: 'Legend' }),
        attribution(),
        scaleBar({ ratio: true }),
        northArrow(),
        graticule({ crs: 'utm' }),
        overviewMap({ layers: () => [new TileLayer({ source: new OSM() })] }),
    ],
});
saveBlob(await toPdf(sheet, { title: 'Population 2020' }), 'map.pdf');
```

## What it does

| Feature | API |
|---|---|
| Render the live map at print size and restore it afterwards | `renderMap`, `freeze` option |
| Paper sizes, orientation, DPI, pixel budget with automatic clamp | `page`, `QUALITY`, `maxPixels` |
| Panel on the right, left, a bottom band or none | `layout` |
| Elements: title, text, date, image, legend, scale bar, north arrow, grid, graticule, overview map, attribution | `title`, `text`, `dateText`, `image`, `legend`, `scaleBar`, `northArrow`, `grid`, `graticule`, `overviewMap`, `attribution` |
| Legends from symbols, images or WMS `GetLegendGraphic`; overflow onto extra pages | `legend`, `wmsLegends` |
| Graticule at round values in lon/lat, UTM or any registered projection, with edge labels | `graticule` |
| UTM conversion (Krüger series, WGS 84) without proj4 | `toUtm`, `fromUtm`, `utmZone` |
| Overview map with the frame footprint, from layers you provide | `overviewMap` |
| Preview with the same pipeline at low DPI | `previewMap` |
| On-screen guide of what will be printed | `printFrame`, `watchPrintFrame`, `usePrintFrame` |
| PNG, JPEG, WebP and a dependency-free PDF writer | `toBlob`, `toBlobs`, `toPdf`, `saveBlob` |
| Progress, cancellation and typed errors | `onProgress`, `signal`, `TaintedCanvasError`, `RenderTimeoutError` |
| Custom elements: anything that implements `SheetElement` | `measure`, `size`, `draw`, `load`, `reserve` |

## Video

```bash
npm install mediabunny gifenc
```

```ts
import { attribution, northArrow, saveBlob, scaleBar, title } from 'cartela';
import { gifEncoder, pickFormat, planRoute, recordMap, recordingDefaults, videoEncoder, videoSupport } from 'cartela/video';

const format = pickFormat('mp4', await videoSupport());
if (!format) throw new Error('No video format available');
const { fps, size } = recordingDefaults(format);
const plan = planRoute(map, route, { fps, size, duration: 12, rotate: true });

const video = await recordMap(map, plan, {
    encoder: format === 'gif' ? gifEncoder() : videoEncoder({ container: format, quality: 'high' }),
    elements: [title('Route', { slot: 'map' }), scaleBar(), northArrow(), attribution({ slot: 'map' })],
    trail: { route },
});
saveBlob(video.blob, `route${video.extension}`);
```

| Feature | API |
|---|---|
| Frame plans: follow a `LineString` at constant ground speed, or orbit around a centre | `planRoute`, `planOrbit`, or any `FramePlan` |
| Deterministic recording: every frame waits for the map to finish rendering | `recordMap` |
| Growing trail and heading marker over the route | `trail` |
| Sheet elements over every frame; scale bar and north arrow follow the view | `elements` (`map` and `frame` slots) |
| MP4 and WebM through WebCodecs, GIF as a fallback | `videoEncoder`, `gifEncoder`, or your own `EncoderFactory` |
| Support detection and format fallback | `videoSupport`, `pickFormat`, `UnsupportedFormatError` |
| Write straight to disk while encoding | `target`, `fileTarget`, `canPickFile` |

Long recordings can go straight to disk instead of memory. Pass a `target` (a `WritableStream` of
positioned chunks, such as the one `showSaveFilePicker` returns) and `video.blob` comes back `null`.
MP4 keeps fast start with `fastStart: 'reserve'`, and a cancelled recording aborts the stream, so no
half-written file is left behind:

```ts
const target = await fileTarget('route.mp4', 'video/mp4');
await recordMap(map, plan, { encoder: videoEncoder({ container: 'mp4', target: target ?? undefined }) });
```

`mediabunny` and `gifenc` are optional peers, loaded with a dynamic `import()` only when a video is
recorded; print-only apps never load them.

`cartela` is the framework-free core; `cartela/video` records video; `cartela/react` adds
`useMapExport`, `usePrintFrame` and `useMapVideo`.
`npm run demo` runs a playground.

`overviewMap` takes a factory, `layers: () => BaseLayer[]`, because an OpenLayers layer cannot live in
two maps at once.

Raster sources must load with `crossOrigin: 'anonymous'`; otherwise the canvas is tainted and
`exportMap` throws `TaintedCanvasError`.

## License

AGPL-3.0-only
