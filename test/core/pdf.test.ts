import { describe, expect, it } from 'vitest';
import { pdfDate, pdfString, writePdf } from '../../src/core/pdf.js';

const decoder = new TextDecoder('latin1');

describe('writePdf', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const bytes = writePdf([{ bytes: jpeg, width: 10, height: 5 }, { bytes: jpeg, width: 10, height: 5 }], [279.4, 215.9], {
        title: 'Mapa de prueba',
        date: new Date(Date.UTC(2026, 9, 9, 12, 0, 0)),
    });
    const text = decoder.decode(bytes);

    it('writes a header, pages and a trailer', () => {
        expect(text.startsWith('%PDF-1.4\n')).toBe(true);
        expect(text).toContain('/Count 2');
        expect(text).toContain('/MediaBox [0 0 792 612]');
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('points every xref entry at its object', () => {
        const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
        expect(text.slice(start, start + 4)).toBe('xref');
        const rows = text.slice(start).split('\n').slice(3).filter(row => row.endsWith(' n '));
        expect(rows).toHaveLength(9);
        rows.forEach((row, i) => {
            const offset = Number(row.slice(0, 10));
            expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
        });
    });

    it('embeds the jpeg bytes untouched', () => {
        expect(text).toContain('/Filter /DCTDecode /Length 4');
        expect(text).toContain('stream\n\xff\xd8\xff\xd9\nendstream');
    });
});

describe('pdf strings', () => {
    it('escapes ascii and hex-encodes unicode', () => {
        expect(pdfString('a(b)\\c')).toBe('(a\\(b\\)\\\\c)');
        expect(pdfString('Año')).toBe('<FEFF004100F1006F>');
    });

    it('formats dates in UTC', () => {
        expect(pdfDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('D:20260102030405Z');
    });
});
