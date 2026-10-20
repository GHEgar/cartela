import { abortError } from '../core/errors.js';

const queues = new WeakMap<object, Promise<void>>();

function waitFor(previous: Promise<void>, signal?: AbortSignal): Promise<void> {
    if (!signal) return previous;
    if (signal.aborted) return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
        const onAbort = (): void => reject(abortError(signal));
        signal.addEventListener('abort', onAbort, { once: true });
        void previous.then(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        });
    });
}

export async function acquire(key: object, signal?: AbortSignal): Promise<() => void> {
    const previous = queues.get(key) ?? Promise.resolve();
    let release = (): void => {};
    const turn = new Promise<void>(resolve => {
        release = resolve;
    });
    const tail = previous.then(() => turn);
    queues.set(key, tail);
    void tail.then(() => {
        if (queues.get(key) === tail) queues.delete(key);
    });
    try {
        await waitFor(previous, signal);
    } catch (error) {
        release();
        throw error;
    }
    return release;
}
