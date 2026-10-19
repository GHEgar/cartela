import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expectTypeOf, it } from 'vitest';
import type { MaplibreMap } from '../../src/maplibre/types.js';

describe('MaplibreMap', () => {
    it('accepts the real maplibre-gl Map', () => {
        expectTypeOf<MapLibreMap>().toExtend<MaplibreMap>();
    });
});
