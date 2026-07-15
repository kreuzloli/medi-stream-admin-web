// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { liveApi } from '../api/live';
import './tencent-live-page';

describe('tencent-live-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('generates and renders push and playback URLs', async () => {
        vi.spyOn(liveApi, 'generateUrls').mockResolvedValue({
            streamName: 'main',
            expireAtEpochSeconds: 1_800_000_000,
            txTimeHex: 'ABC',
            pushWebrtc: 'webrtc://push/main',
            pushRtmp: 'rtmp://push/main',
            playWebrtc: 'webrtc://play/main',
            playRtmp: 'rtmp://play/main',
            playFlv: 'https://play/main.flv',
            playHls: 'https://play/main.m3u8',
        });
        const page = document.createElement('tencent-live-page');
        document.body.append(page);
        const form = page.querySelector<HTMLFormElement>('[data-url-form]')!;
        form.querySelector<HTMLInputElement>('[name="streamName"]')!.value = 'main';

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(page.textContent).toContain('rtmp://push/main'));

        expect(page.textContent).toContain('https://play/main.m3u8');
    });

    it('queries and renders the Tencent stream state response', async () => {
        const streamState = vi.spyOn(liveApi, 'streamState').mockResolvedValue({
            Response: { StreamState: 'active', RequestId: 'request-1' },
        });
        const page = document.createElement('tencent-live-page');
        document.body.append(page);
        const form = page.querySelector<HTMLFormElement>('[data-state-form]')!;
        form.querySelector<HTMLInputElement>('[name="appName"]')!.value = 'live';
        form.querySelector<HTMLInputElement>('[name="domainName"]')!.value = 'push.example.com';
        form.querySelector<HTMLInputElement>('[name="streamName"]')!.value = 'main';

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(page.textContent).toContain('active'));

        expect(streamState).toHaveBeenCalledWith({
            AppName: 'live', DomainName: 'push.example.com', StreamName: 'main',
        });
    });
});
