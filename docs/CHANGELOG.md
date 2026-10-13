# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con
[SemVer](https://semver.org/lang/es/).

## [No publicado]

## [0.2.0] - 2026-10-13

### Agregado

- `cartela/video`: grabación del mapa como video, cuadro por cuadro y sin depender del tiempo real.
  - `recordMap` graba cualquier `FramePlan` en una sola sesión de target canvas, con estela de ruta
    y los elementos de la hoja sobre cada cuadro.
  - `planRoute` recorre un `LineString` a velocidad constante sobre la longitud geodésica, con
    seguimiento, rumbo suavizado, pausas y easing. `planOrbit` gira la vista y cierra el loop sin
    repetir cuadro.
  - `videoEncoder` (MP4 y WebM con mediabunny) y `gifEncoder` (GIF con gifenc), ambos peers
    opcionales cargados con `import()` dinámico.
  - `videoSupport`, `pickFormat` y `recordingDefaults` para detectar soporte y elegir formato.
- `openSession`: sesión reutilizable de target canvas para renderizar varias vistas seguidas.
- `UnsupportedFormatError`.
- `title` y `text` aceptan `slot: 'map'` con `position`, `halo` y `maxWidth` para ir sobre el mapa.
- `cartela/react`: `useMapVideo`.
- Demo con grabación de ruta y órbita, y pruebas de planes y de los tres formatos.

### Cambiado

- `renderMap` usa `openSession` por dentro; su API y su comportamiento no cambian.

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
