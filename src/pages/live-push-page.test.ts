// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import { logger } from '../common/logger';
import { LivePusherComponent } from '../components/live-pusher';
import './live-push-page';
import type { LivePushPage } from './live-push-page';

const generatedUrls = {
    roomId: 5,
    liveConfigId: 1,
    appName: 'medi-stream',
    pushDomain: 'push.example.com',
    playDomain: 'live.example.com',
    expireAtEpochSeconds: 2_000_000_000,
    streams: [
        {
            streamId: 11,
            streamCode: 'SR11',
            streamName: 'side',
            title: '副机位',
            isDefault: false,
            expireAtEpochSeconds: 2_000_000_000,
            txTimeHex: 'ABC',
            pushWebrtc: 'webrtc://push.example.com/live/side',
            pushRtmp: 'rtmp://push.example.com/live/side',
            playWebrtc: 'webrtc://live.example.com/live/side',
            playRtmp: 'rtmp://live.example.com/live/side',
            playFlv: 'https://live.example.com/live/side.flv',
            playHls: 'https://live.example.com/live/side.m3u8',
        },
        {
            streamId: 12,
            streamCode: 'SR12',
            streamName: 'main',
            title: '主机位',
            isDefault: true,
            expireAtEpochSeconds: 2_000_000_000,
            txTimeHex: 'DEF',
            pushWebrtc: 'webrtc://push.example.com/live/main',
            pushRtmp: 'rtmp://push.example.com/live/main',
            playWebrtc: 'webrtc://live.example.com/live/main',
            playRtmp: 'rtmp://live.example.com/live/main',
            playFlv: 'https://live.example.com/live/main.flv',
            playHls: 'https://live.example.com/live/main.m3u8',
        },
    ],
};

describe('live-push-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('generates every enabled stream URL and selects the default stream', async () => {
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        vi.spyOn(liveApi, 'liveConfigs').mockResolvedValue([
            {
                id: 1,
                name: '默认配置',
                appName: 'medi-stream',
                pushDomain: 'push.example.com',
                playDomain: 'live.example.com',
                defaultTtlSeconds: 86400,
            },
            {
                id: 2,
                name: '备用配置',
                appName: 'medi-stream-backup',
                pushDomain: 'push-backup.example.com',
                playDomain: 'live-backup.example.com',
                defaultTtlSeconds: 86400,
            },
        ]);
        const generate = vi.spyOn(liveApi, 'generateRoomUrls').mockResolvedValue(generatedUrls);
        const page = document.createElement('live-push-page') as LivePushPage;
        document.body.append(page);

        await page.update(5);
        page.querySelector<HTMLSelectElement>('[name="liveConfigId"]')!.value = '1';
        page.querySelector<HTMLFormElement>('[data-generate-form]')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );

        await vi.waitFor(() => expect(generate).toHaveBeenCalledWith(5, { liveConfigId: 1 }));
        await vi.waitFor(() => expect(page.textContent).toContain('主机位'));
        expect(page.textContent).toContain('副机位');
        expect(page.textContent).toContain('webrtc://push.example.com/live/main');
        expect(page.textContent).toContain('https://live.example.com/live/side.m3u8');
        expect(page.querySelector<HTMLInputElement>('[name="streamId"]:checked')?.value).toBe('12');
        expect(page.querySelector('[data-qr-placeholder]')).not.toBeNull();
        expect(page.querySelector('[data-chat-placeholder]')).not.toBeNull();

        const config = page.querySelector<HTMLSelectElement>('[name="liveConfigId"]')!;
        config.value = '2';
        config.dispatchEvent(new Event('change', { bubbles: true }));
        expect(page.querySelector<HTMLButtonElement>('[data-start-push]')?.disabled).toBe(true);
    });

    it('starts the default stream and keeps pushing when active stream sync is not deployed', async () => {
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        vi.spyOn(liveApi, 'liveConfigs').mockResolvedValue([{
            id: 1, name: '默认配置', appName: 'medi-stream', pushDomain: 'push.example.com',
            playDomain: 'live.example.com', defaultTtlSeconds: 86400,
        }]);
        vi.spyOn(liveApi, 'generateRoomUrls').mockResolvedValue(generatedUrls);
        vi.spyOn(liveApi, 'setActiveStream').mockRejectedValue(new ApiError(404, 'Not Found'));
        vi.spyOn(LivePusherComponent.prototype, 'startPush').mockResolvedValue(true);
        const info = vi.spyOn(logger, 'info');
        const warn = vi.spyOn(logger, 'warn');
        const page = document.createElement('live-push-page') as LivePushPage;
        document.body.append(page);
        await page.update(5);
        page.querySelector<HTMLSelectElement>('[name="liveConfigId"]')!.value = '1';
        page.querySelector<HTMLFormElement>('[data-generate-form]')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );
        await vi.waitFor(() => expect(page.querySelector('[data-start-push]')).not.toBeNull());

        page.querySelector<HTMLButtonElement>('[data-start-push]')!.click();

        await vi.waitFor(() => expect(LivePusherComponent.prototype.startPush).toHaveBeenCalledWith(
            'webrtc://push.example.com/live/main',
        ));
        await vi.waitFor(() => expect(page.textContent).toContain('活动链路同步接口待接入'));
        expect(info).toHaveBeenCalledWith('administrator live push started', { roomId: 5, streamId: 12 });
        expect(page.querySelector<HTMLSelectElement>('[name="liveConfigId"]')?.disabled).toBe(true);
        expect(page.querySelectorAll<HTMLInputElement>('[name="streamId"]:disabled')).toHaveLength(2);

        page.remove();
        await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(
            'active live stream cleanup failed',
            expect.objectContaining({ roomId: 5, errorType: 'ApiError' }),
        ));
    });

    it('restores generated URLs and the active stream when runtime data is available', async () => {
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1, streams: [],
        });
        vi.spyOn(liveApi, 'liveConfigs').mockResolvedValue([{
            id: 1, name: '默认配置', appName: 'medi-stream', pushDomain: 'push.example.com',
            playDomain: 'live.example.com', defaultTtlSeconds: 86400,
        }]);
        vi.spyOn(liveApi, 'liveRuntime').mockResolvedValue({ ...generatedUrls, activeStreamId: 11 });
        const page = document.createElement('live-push-page') as LivePushPage;
        document.body.append(page);

        await page.update(5);

        expect(page.textContent).toContain('webrtc://push.example.com/live/main');
        expect(page.querySelector<HTMLInputElement>('[name="streamId"]:checked')?.value).toBe('11');
    });

    it('offers a retry when room or config loading fails', async () => {
        vi.spyOn(liveApi, 'room').mockRejectedValue(new ApiError(500, '服务异常'));
        vi.spyOn(liveApi, 'liveConfigs').mockResolvedValue([]);
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        const page = document.createElement('live-push-page') as LivePushPage;
        document.body.append(page);

        await page.update(5);

        expect(page.textContent).toContain('服务异常');
        expect(page.querySelector('[data-retry-load]')).not.toBeNull();
    });
});
