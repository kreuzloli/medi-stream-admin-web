// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import { LivePlayerComponent } from '../components/live-player';
import './live-play-page';
import type { LivePlayPage } from './live-play-page';

describe('live-play-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('plays the active stream with WebRTC, FLV and HLS fallbacks', async () => {
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        vi.spyOn(liveApi, 'liveRuntime').mockResolvedValue({
            roomId: 5, liveConfigId: 1, activeStreamId: 12, appName: 'medi-stream',
            pushDomain: 'push.example.com', playDomain: 'live.example.com', expireAtEpochSeconds: 2_000_000_000,
            streams: [{
                streamId: 12, streamCode: 'SR12', streamName: 'main', title: '主机位', isDefault: true,
                expireAtEpochSeconds: 2_000_000_000, txTimeHex: 'DEF',
                pushWebrtc: 'webrtc://push/main', pushRtmp: 'rtmp://push/main',
                playWebrtc: 'webrtc://live/main', playRtmp: 'rtmp://live/main',
                playFlv: 'https://live/main.flv', playHls: 'https://live/main.m3u8',
            }],
        });
        vi.spyOn(liveApi, 'roomStreamState').mockResolvedValue({ Response: { LiveStreamState: 'active' } });
        const play = vi.spyOn(LivePlayerComponent.prototype, 'playSources').mockResolvedValue(true);
        const page = document.createElement('live-play-page') as LivePlayPage;
        document.body.append(page);

        await page.update(5);

        expect(play).toHaveBeenCalledWith([
            { src: 'webrtc://live/main', type: 'webrtc' },
            { src: 'https://live/main.flv', type: 'video/x-flv' },
            { src: 'https://live/main.m3u8', type: 'application/x-mpegURL' },
        ]);
        expect(page.textContent).toContain('主机位');
        expect(page.querySelector('[data-qr-placeholder]')).not.toBeNull();
        expect(page.querySelector('[data-chat-placeholder]')).not.toBeNull();
    });

    it('shows an explicit pending state while the runtime API is not deployed', async () => {
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        const page = document.createElement('live-play-page') as LivePlayPage;
        document.body.append(page);

        await page.update(5);

        expect(page.textContent).toContain('直播运行信息接口暂未接入');
        expect(page.querySelector('[data-qr-placeholder]')).not.toBeNull();
        expect(page.querySelector('[data-chat-placeholder]')).not.toBeNull();
    });

    it('stops playback when the active stream is no longer live', async () => {
        vi.useFakeTimers();
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        const runtime = {
            roomId: 5, liveConfigId: 1, activeStreamId: 12, appName: 'medi-stream',
            pushDomain: 'push.example.com', playDomain: 'live.example.com', expireAtEpochSeconds: 2_000_000_000,
            streams: [{
                streamId: 12, streamCode: 'SR12', streamName: 'main', title: '主机位', isDefault: true,
                expireAtEpochSeconds: 2_000_000_000, txTimeHex: 'DEF',
                pushWebrtc: 'webrtc://push/main', pushRtmp: 'rtmp://push/main',
                playWebrtc: 'webrtc://live/main', playRtmp: 'rtmp://live/main',
                playFlv: 'https://live/main.flv', playHls: 'https://live/main.m3u8',
            }],
        };
        vi.spyOn(liveApi, 'liveRuntime')
            .mockResolvedValueOnce(runtime)
            .mockResolvedValueOnce({ ...runtime, activeStreamId: null });
        vi.spyOn(liveApi, 'roomStreamState').mockResolvedValue({ Response: { LiveStreamState: 'active' } });
        vi.spyOn(LivePlayerComponent.prototype, 'playSources').mockResolvedValue(true);
        const destroy = vi.spyOn(LivePlayerComponent.prototype, 'destroy');
        const page = document.createElement('live-play-page') as LivePlayPage;
        document.body.append(page);
        await page.update(5);

        await vi.advanceTimersByTimeAsync(15_000);

        expect(destroy).toHaveBeenCalled();
        expect(page.textContent).toContain('直播已结束');
    });
});
