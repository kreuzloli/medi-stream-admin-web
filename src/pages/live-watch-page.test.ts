// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import './live-watch-page';
import type { LiveWatchPage } from './live-watch-page';

const rooms = {
    records: [{ id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1 }],
    total: 1, size: 20, current: 1, pages: 1,
};

describe('live-watch-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.location.hash = '';
        vi.restoreAllMocks();
    });

    it('shows a stable watch action and treats missing runtime data as offline', async () => {
        vi.spyOn(liveApi, 'rooms').mockResolvedValue(rooms);
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        const page = document.createElement('live-watch-page') as LiveWatchPage;
        document.body.append(page);

        await page.update();
        expect(page.textContent).toContain('手术直播');
        expect(page.textContent).toContain('未开播');
        page.querySelector<HTMLButtonElement>('[data-watch="5"]')!.click();

        await vi.waitFor(() => expect(page.textContent).toContain('当前直播间未开播'));
    });

    it('shows a cover placeholder when the cover file cannot be loaded', async () => {
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            ...rooms,
            records: [{ ...rooms.records[0], coverFileId: 12 }],
        });
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
        const file = vi.spyOn(liveApi, 'file').mockRejectedValue(new ApiError(404, 'Not Found'));
        const page = document.createElement('live-watch-page') as LiveWatchPage;
        document.body.append(page);

        await page.update();

        expect(file).toHaveBeenCalledWith(12);
        expect(page.querySelector('.live-room-list-cover img')).toBeNull();
        expect(page.querySelector('.live-room-cover-placeholder')).not.toBeNull();
        expect(page.textContent).toContain('手术直播');
    });

    it('opens the play page only when the selected active stream is live', async () => {
        vi.spyOn(liveApi, 'rooms').mockResolvedValue(rooms);
        vi.spyOn(liveApi, 'liveRuntime').mockResolvedValue({
            roomId: 5,
            liveConfigId: 1,
            activeStreamId: 12,
            appName: 'medi-stream',
            pushDomain: 'push.example.com',
            playDomain: 'live.example.com',
            expireAtEpochSeconds: 2_000_000_000,
            streamState: 'active',
            isLive: true,
            streams: [{
                streamId: 12, streamCode: 'SR12', streamName: 'main', title: '主机位', isDefault: true,
                expireAtEpochSeconds: 2_000_000_000, txTimeHex: 'DEF',
                pushWebrtc: 'webrtc://push/main', pushRtmp: 'rtmp://push/main',
                playWebrtc: 'webrtc://live/main', playRtmp: 'rtmp://live/main',
                playFlv: 'https://live/main.flv', playHls: 'https://live/main.m3u8',
            }],
        });
        const state = vi.spyOn(liveApi, 'roomStreamState');
        const page = document.createElement('live-watch-page') as LiveWatchPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-watch="5"]')!.click();

        await vi.waitFor(() => expect(window.location.hash).toBe('#/live/play?roomId=5'));
        expect(state).not.toHaveBeenCalled();
    });
});
