// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LivePusherComponent } from './live-pusher';

describe('live-pusher', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.TXLivePusher;
        vi.restoreAllMocks();
    });

    it('starts WebRTC push and releases SDK resources when destroyed', async () => {
        const instance = {
            setRenderView: vi.fn(),
            setVideoQuality: vi.fn(),
            setAudioQuality: vi.fn(),
            setProperty: vi.fn(),
            startCamera: vi.fn().mockResolvedValue('camera-1'),
            stopCamera: vi.fn(),
            startMicrophone: vi.fn().mockResolvedValue('microphone-1'),
            stopMicrophone: vi.fn(),
            startScreenCapture: vi.fn().mockResolvedValue('screen-1'),
            stopScreenCapture: vi.fn(),
            startPush: vi.fn().mockResolvedValue(undefined),
            stopPush: vi.fn(),
            isPushing: vi.fn().mockReturnValue(false),
            pauseVideo: vi.fn(),
            pauseAudio: vi.fn(),
            resumeVideo: vi.fn(),
            resumeAudio: vi.fn(),
            setObserver: vi.fn(),
            destroy: vi.fn(),
        };
        class TXLivePusherMock {
            static checkSupport = vi.fn().mockResolvedValue({
                isWebRTCSupported: true,
                isMediaDevicesSupported: true,
            });

            constructor() {
                return instance;
            }
        }
        window.TXLivePusher = TXLivePusherMock as unknown as typeof window.TXLivePusher;
        const component = new LivePusherComponent();
        document.body.append(component);

        await component.startPreview({ videoQuality: '720p', audioQuality: 'standard', captureMode: 'camera' });
        await expect(component.startPush('webrtc://push.example.com/live/main')).resolves.toBe(true);
        component.destroy();

        expect(instance.startCamera).toHaveBeenCalled();
        expect(instance.startMicrophone).toHaveBeenCalled();
        expect(instance.startPush).toHaveBeenCalledWith('webrtc://push.example.com/live/main');
        expect(instance.stopPush).toHaveBeenCalled();
        expect(instance.stopCamera).toHaveBeenCalledWith('camera-1');
        expect(instance.stopMicrophone).toHaveBeenCalledWith('microphone-1');
        expect(instance.destroy).toHaveBeenCalled();
    });
});
