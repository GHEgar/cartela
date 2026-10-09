# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con
[SemVer](https://semver.org/lang/es/).

## [No publicado]

## [0.1.0] - 2026-10-09

### Agregado

- `renderMap`: dibuja el mapa en un canvas como target de OpenLayers, al tamaño y DPI de la hoja, y
  restaura target, vista y pixel ratio aunque falle. Congela la imagen en pantalla mientras tanto.
- `exportMap` y `previewMap`: hoja con papel, orientación, DPI, márgenes y presupuesto de píxeles.
- Distribuciones `right`, `left`, `bottom` y `none`; lo que no cabe en el panel pasa a otras páginas.
- Elementos: `title`, `text`, `dateText`, `image`, `legend`, `scaleBar`, `northArrow`, `grid` y
  `attribution`. Leyendas de símbolo, imagen y WMS (`wmsLegends`).
- `printFrame` y `watchPrintFrame` para la guía en pantalla.
- Salida PNG, JPEG y WebP, y PDF propio sin dependencias.
- `cartela/react`: `useMapExport` y `usePrintFrame`.
- Demo en Vite y pruebas con Vitest y Playwright.
