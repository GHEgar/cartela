export const THEME = { fontFamily: 'Rotulo, system-ui, sans-serif' };

export const CLASSES = ['#e8f1d6', '#bfdc9c', '#86c06c', '#4f9a4a', '#2a6b36'];

export const ORIGIN: [number, number] = [-103.6, 20.45];
export const STEP = 0.05;
export const ROUTE: [number, number][] = [[-103.55, 20.5], [-103.4, 20.62], [-103.25, 20.58], [-103.12, 20.8]];

export function noise(i: number, j: number): number {
    const value = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return value - Math.floor(value);
}
