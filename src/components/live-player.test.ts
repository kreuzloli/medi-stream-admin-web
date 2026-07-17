// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LivePlayerComponent } from './live-player';

describe('live-player', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.TCPlayer;
        vi.restoreAllMocks();
    });

    it('uses the proxied license and disposes the player after multi-source playback', async () => {
        const player = { src: vi.fn(), play: vi.fn(), pause: vi.fn(), dispose: vi.fn() };
        window.TCPlayer = vi.fn().mockReturnValue(player);
        const component = new LivePlayerComponent();
        document.body.append(component);

        await expect(component.playSources([
            { src: 'webrtc://live.example.com/live/main', type: 'webrtc' },
            { src: 'https://live.example.com/live/main.flv', type: 'video/x-flv' },
        ])).resolves.toBe(true);
        component.destroy();

        expect(window.TCPlayer).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            licenseUrl: '/api/live/license',
            controls: true,
        }));
        expect(player.src).toHaveBeenCalledWith([
            { src: 'webrtc://live.example.com/live/main', type: 'webrtc' },
            { src: 'https://live.example.com/live/main.flv', type: 'video/x-flv' },
        ]);
        expect(player.play).toHaveBeenCalled();
        expect(player.dispose).toHaveBeenCalled();
    });
});
