import type { FileChunk, VideoTarget } from './types.js';

export interface Relay {
    writable: VideoTarget;
    write: (chunk: FileChunk) => Promise<void>;
    close: () => Promise<void>;
    abort: (reason?: unknown) => Promise<void>;
}

export function relay(target: VideoTarget): Relay {
    const writer = target.getWriter();
    let done = false;
    const close = async (): Promise<void> => {
        if (done) return;
        done = true;
        await writer.close();
    };
    const abort = async (reason?: unknown): Promise<void> => {
        if (done) return;
        done = true;
        await writer.abort(reason).catch(() => undefined);
    };
    const write = (chunk: FileChunk): Promise<void> => writer.write(chunk);
    const writable = new WritableStream<FileChunk>({ write, close, abort });
    return { writable, write, close, abort };
}

interface SavePicker {
    showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{ createWritable: () => Promise<VideoTarget> }>;
}

export function canPickFile(): boolean {
    return typeof (globalThis as SavePicker).showSaveFilePicker === 'function';
}

export async function fileTarget(name: string, mimeType: string): Promise<VideoTarget | null> {
    const picker = (globalThis as SavePicker).showSaveFilePicker;
    if (!picker) return null;
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const handle = await picker({
        suggestedName: name,
        ...(extension ? { types: [{ accept: { [mimeType]: [extension] } }] } : {}),
    });
    return handle.createWritable();
}
