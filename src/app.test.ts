import { describe, expect, it } from 'vitest';

import { canAccessRoute, pageTagForRouteKind } from './app';

describe('pageTagForRouteKind', () => {
    it.each([
        ['liveWatch', '<live-watch-page></live-watch-page>'],
        ['livePush', '<live-push-page></live-push-page>'],
        ['livePlay', '<live-play-page></live-play-page>'],
    ] as const)('renders %s with its concrete page', (kind, tag) => {
        expect(pageTagForRouteKind(kind)).toBe(tag);
    });
});

describe('canAccessRoute', () => {
    it('protects viewing pages with LIVE_VIEW and the push page with TENCENT_LIVE_MANAGE', () => {
        const viewer = { roles: [], permissions: ['LIVE_VIEW'] };
        const pusher = { roles: [], permissions: ['TENCENT_LIVE_MANAGE'] };

        expect(canAccessRoute('liveWatch', viewer)).toBe(true);
        expect(canAccessRoute('livePlay', viewer)).toBe(true);
        expect(canAccessRoute('livePush', viewer)).toBe(false);
        expect(canAccessRoute('livePush', pusher)).toBe(true);
        expect(canAccessRoute('liveWatch', pusher)).toBe(false);
    });
});
