# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con
[SemVer](https://semver.org/lang/es/).

## [No publicado]

### Agregado

- `release.yml`: un tag `vX.Y.Z` corre las pruebas, crea el release con su sección del CHANGELOG y
  publica en npm con procedencia y en GitHub Packages.

### Cambiado

- El demo está en inglés.
- El e2e levanta el demo en el puerto 5191.

## [0.5.0] - 2026-10-14

### Agregado

- `planHold(map, { frames | duration, fps, size })`: repite la vista actual, para grabar cómo cambia
  una capa sin mover la cámara (por ejemplo, las fechas de un WMS con zootropo).
- `beforeFrame(frame, index)` en `recordMap`: cambia el mapa antes de cada cuadro; el cuadro espera a que
  termine de dibujarse. Receta con zootropo en el README.

## [0.4.0] - 2026-10-13

### Agregado

- Video directo a disco: `videoEncoder` y `gifEncoder` aceptan `target`, un `WritableStream` de
  bloques con posición, como el de `showSaveFilePicker`. El archivo se escribe mientras se codifica.
  El MP4 conserva fast start con `fastStart: 'reserve'`, y el GIF vacía el búfer de gifenc en cada
  cuadro.
- `fileTarget` y `canPickFile` para pedir el archivo con el selector del navegador.
- Al cancelar, el stream se aborta en vez de cerrarse, así que no queda un archivo a medias.

### Cambiado

- `Video.blob` es `Blob | null`: es `null` cuando el video se escribió en un `target`.
- `EncoderFactory` recibe un tercer argumento, el número de cuadros. Las fábricas propias que
  existan siguen funcionando.

### Cambiado

- El lint usa `@ghegar/eslint-config` (presets `base`, `react` y `ts`) en lugar de una config propia.

## [0.3.0] - 2026-10-13

### Agregado

- `graticule`: retícula en valores redondos de lon/lat, UTM o cualquier proyección registrada en
  OpenLayers. Las líneas se trazan como curvas, funciona con la vista rotada y etiqueta los cruces
  con los cuatro bordes sin encimar etiquetas ni salirse de las esquinas. Intervalo automático en
  pasos de grados, minutos y segundos o de 1, 2, 2,5 y 5 metros por potencia de diez.
- `toUtm`, `fromUtm` y `utmZone`: transversa de Mercator con la serie de Krüger sobre WGS 84, sin
  dependencias, con zona y hemisferio forzables.
- `overviewMap`: minimapa con las capas que da la app (fábrica de capas) y la huella del marco,
  rotada si la vista lo está; en esquina del mapa o en el panel. En video se carga una vez y la
  huella se mueve en cada cuadro.
- `DrawEnv.toPixel`, `coordinateToPixel` y `formatMeters`.
- Demo con selector de retícula y minimapa; pruebas de UTM, intervalos y cruces, y e2e de hoja con
  retícula UTM y minimapa.

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
