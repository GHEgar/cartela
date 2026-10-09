import { MM_PER_INCH } from './units.js';
import type { Size } from './types.js';

export interface PdfImage {
    bytes: Uint8Array;
    width: number;
    height: number;
}

export interface PdfMeta {
    title?: string;
    author?: string;
    date?: Date;
}

const encoder = new TextEncoder();

const mmToPt = (mm: number): number => Number(((mm * 72) / MM_PER_INCH).toFixed(3));

export function pdfString(value: string): string {
    if (/^[\x20-\x7e]*$/.test(value)) return `(${value.replace(/[\\()]/g, '\\$&')})`;
    let hex = 'FEFF';
    for (let i = 0; i < value.length; i += 1) hex += value.charCodeAt(i).toString(16).padStart(4, '0');
    return `<${hex.toUpperCase()}>`;
}

export function pdfDate(date: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
        + `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

class Writer {
    private readonly chunks: Uint8Array[] = [];
    private length = 0;
    readonly offsets: number[] = [];

    push(part: string | Uint8Array): void {
        const bytes = typeof part === 'string' ? encoder.encode(part) : part;
        this.chunks.push(bytes);
        this.length += bytes.length;
    }

    object(id: number, body: string, stream?: Uint8Array): void {
        this.offsets[id] = this.length;
        this.push(`${id} 0 obj\n${body}\n`);
        if (stream) {
            this.push('stream\n');
            this.push(stream);
            this.push('\nendstream\n');
        }
        this.push('endobj\n');
    }

    get size(): number {
        return this.length;
    }

    bytes(): Uint8Array {
        const out = new Uint8Array(this.length);
        let offset = 0;
        for (const chunk of this.chunks) {
            out.set(chunk, offset);
            offset += chunk.length;
        }
        return out;
    }
}

export function writePdf(images: readonly PdfImage[], paper: Size, meta: PdfMeta = {}): Uint8Array {
    const writer = new Writer();
    const width = mmToPt(paper[0]);
    const height = mmToPt(paper[1]);
    const pageIds = images.map((_, i) => 4 + i * 3);
    const count = 4 + images.length * 3;

    writer.push('%PDF-1.4\n');
    writer.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    writer.object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    writer.object(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`);
    const info = [
        `/Producer ${pdfString('cartela')}`,
        `/CreationDate ${pdfString(pdfDate(meta.date ?? new Date()))}`,
        meta.title ? `/Title ${pdfString(meta.title)}` : '',
        meta.author ? `/Author ${pdfString(meta.author)}` : '',
    ].filter(Boolean).join(' ');
    writer.object(3, `<< ${info} >>`);

    images.forEach((image, i) => {
        const pageId = 4 + i * 3;
        const contents = encoder.encode(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
        writer.object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] `
            + `/Resources << /XObject << /Im0 ${pageId + 2} 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
        writer.object(pageId + 1, `<< /Length ${contents.length} >>`, contents);
        writer.object(pageId + 2, `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} `
            + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>`, image.bytes);
    });

    const xref = writer.size;
    const rows = ['0000000000 65535 f \n'];
    for (let id = 1; id < count; id += 1) rows.push(`${String(writer.offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
    writer.push(`xref\n0 ${count}\n${rows.join('')}`);
    writer.push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return writer.bytes();
}
