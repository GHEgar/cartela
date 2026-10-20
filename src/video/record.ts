import type OlMap from 'ol/Map.js';
import { openSession } from '../core/session.js';
import { resolveTheme } from '../core/theme.js';
import { recordFrames } from './frames.js';
import { addTrail } from './trail.js';
import type { FramePlan, FrameSource, FrameState, RecordOptions, Video } from './types.js';

export { MAX_FRAMES, overlayDpi } from './frames.js';

export function recordMap(map: OlMap, plan: FramePlan, options: RecordOptions): Promise<Video> {
    const open = (size: [number, number]): FrameSource<FrameState> => {
        const session = openSession(map, {
            size,
            pixelRatio: 1,
            freeze: options.freeze !== false,
            ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
            ...(options.onTimeout ? { onTimeout: options.onTimeout } : {}),
        });
        const trail = options.trail ? addTrail(map, options.trail, resolveTheme(options.theme)) : null;
        return {
            render: (frame, signal) => {
                trail?.update(frame);
                return session.render(frame, signal);
            },
            close: () => {
                trail?.remove();
                session.close();
            },
        };
    };
    return recordFrames(open, plan, options);
}
