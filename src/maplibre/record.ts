import { resolveTheme } from '../core/theme.js';
import type { Size } from '../core/types.js';
import { recordFrames } from '../video/frames.js';
import type { FrameSource, Video } from '../video/types.js';
import { snapshotOf } from './camera.js';
import { openCapture } from './capture.js';
import { addTrail, type MaplibreTrail } from './trail.js';
import type { CameraFrame, CameraPlan, MaplibreMap, MaplibreRecordOptions } from './types.js';

export function recordMap(map: MaplibreMap, plan: CameraPlan, options: MaplibreRecordOptions): Promise<Video> {
    const open = async (size: Size): Promise<FrameSource<CameraFrame>> => {
        const session = await openCapture(map, size, {
            padding: options.padding ?? 0,
            ...(options.inset ? { inset: options.inset } : {}),
            ...(options.freeze === undefined ? {} : { freeze: options.freeze }),
            ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
            ...(options.onTimeout ? { onTimeout: options.onTimeout } : {}),
            ...(options.overlays ? { overlays: options.overlays } : {}),
            ...(options.signal ? { signal: options.signal } : {}),
        });
        let trail: MaplibreTrail | null;
        try {
            trail = options.trail ? addTrail(map, options.trail, resolveTheme(options.theme)) : null;
        } catch (error) {
            session.close();
            throw error;
        }
        return {
            render: async (frame, signal) => {
                trail?.update(frame);
                const captured = await session.render(frame, signal);
                return snapshotOf({ ...captured, size, pixelRatio: 1, cssWidth: session.rect.width });
            },
            close: () => {
                trail?.remove();
                session.close();
            },
        };
    };
    return recordFrames(open, plan, options);
}
