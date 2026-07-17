import { describe, expect, it } from 'vitest';

import { matchRoute, routePathFromHash, routeRoomIdFromHash } from './routes';

describe('matchRoute', () => {
    it('returns the welcome route for the application root', () => {
        expect(matchRoute('/')).toMatchObject({ title: '工作台', kind: 'welcome' });
    });

    it('maps live routes to their real pages', () => {
        expect(matchRoute('/live/rooms')).toMatchObject({ title: '直播间管理', kind: 'liveRooms' });
        expect(matchRoute('/live/tencent')).toMatchObject({ title: '腾讯云直播', kind: 'tencentLive' });
        expect(matchRoute('/live/watch')).toMatchObject({ title: '观看直播', kind: 'liveWatch' });
        expect(matchRoute('/live/push')).toMatchObject({ title: '直播推流', kind: 'livePush' });
        expect(matchRoute('/live/play')).toMatchObject({ title: '观看直播', kind: 'livePlay' });
    });

    it.each([
        ['/users', 'users'],
        ['/access/admins', 'admins'],
        ['/access/roles', 'roles'],
        ['/access/permissions', 'permissions'],
    ])('maps %s to its management page', (path, kind) => {
        expect(matchRoute(path)).toMatchObject({ kind });
    });

    it('falls back to the welcome route for an unknown path', () => {
        expect(matchRoute('/not-found')).toMatchObject({ title: '工作台', kind: 'welcome' });
    });

    it('reads the route from a hash without depending on the deployment pathname', () => {
        expect(routePathFromHash('#/live/rooms')).toBe('/live/rooms');
        expect(routePathFromHash('')).toBe('/');
    });

    it('reads a positive room id from the hash query', () => {
        expect(routeRoomIdFromHash('#/live/push?roomId=12')).toBe(12);
        expect(routeRoomIdFromHash('#/live/play?roomId=0')).toBeNull();
        expect(routeRoomIdFromHash('#/live/play?roomId=invalid')).toBeNull();
    });
});
