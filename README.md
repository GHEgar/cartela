# cartela

Headless print export for [OpenLayers](https://openlayers.org) maps. cartela renders the map straight
into a canvas sized for paper and DPI, composes a sheet around it — title, legend, scale bar, north
arrow, coordinate grid, attributions — and hands you PNG, JPEG, WebP or PDF. It ships no CSS, no
brand and no UI: you build the dialog, cartela builds the sheet.

```bash
npm install cartela ol
```

```ts
import { exportMap, toPdf, saveBlob, title, legend, scaleBar, northArrow, grid, attribution, wmsLegends } from 'cartela';

const sheet = await exportMap(map, {
    page: { size: 'letter', orientation: 'landscape', dpi: 200 },
    layout: 'right',
    elements: [
        title('Population 2020'),
        legend(wmsLegends(map), { title: 'Legend' }),
        attribution(),
        scaleBar({ ratio: true }),
        northArrow(),
        grid({ divisions: [4, 3] }),
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
| Elements: title, text, date, image, legend, scale bar, north arrow, grid, attribution | `title`, `text`, `dateText`, `image`, `legend`, `scaleBar`, `northArrow`, `grid`, `attribution` |
| Legends from symbols, images or WMS `GetLegendGraphic`; overflow onto extra pages | `legend`, `wmsLegends` |
| Preview with the same pipeline at low DPI | `previewMap` |
| On-screen guide of what will be printed | `printFrame`, `watchPrintFrame`, `usePrintFrame` |
| PNG, JPEG, WebP and a dependency-free PDF writer | `toBlob`, `toBlobs`, `toPdf`, `saveBlob` |
| Progress, cancellation and typed errors | `onProgress`, `signal`, `TaintedCanvasError`, `RenderTimeoutError` |
| Custom elements: anything that implements `SheetElement` | `measure`, `size`, `draw`, `load`, `reserve` |

`cartela` is the framework-free core; `cartela/react` adds `useMapExport` and `usePrintFrame`.
`npm run demo` runs a playground.

Raster sources must load with `crossOrigin: 'anonymous'`; otherwise the canvas is tainted and
`exportMap` throws `TaintedCanvasError`.

## License

AGPL-3.0-only
