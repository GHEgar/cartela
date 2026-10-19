import type { Size } from '../core/types.js';
import { recordFrames } from '../video/frames.js';
import type { FrameSource, Video } from '../video/types.js';
import { snapshotOf } from './camera.js';
import { openCapture } from './capture.js';
import type { CameraFrame, CameraPlan, MaplibreMap, MaplibreRecordOptions } from './types.js';

export function recordMap(map: MaplibreMap, plan: CameraPlan, options: MaplibreRecordOptions): Promise<Video> {
    const open = async (size: Size): Promise<FrameSource<CameraFrame>> => {
        const session = await openCapture(map, size, {
            padding: options.padding ?? 0,
            ...(options.freeze === undefined ? {} : { freeze: options.freeze }),
            ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
            ...(options.overlays ? { overlays: options.overlays } : {}),
            ...(options.signal ? { signal: options.signal } : {}),
        });
        return {
            render: async (frame, signal) => {
                const captured = await session.render(frame, signal);
                return snapshotOf({ ...captured, size, pixelRatio: 1, cssWidth: session.rect.width });
            },
            close: session.close,
        };
    };
    return recordFrames(open, plan, options);
}
