import { describe, expect, it } from 'vitest';

import { matchRoute, routePathFromHash } from './routes';

describe('matchRoute', () => {
    it('returns the welcome route for the application root', () => {
        expect(matchRoute('/')).toMatchObject({ title: '工作台', kind: 'welcome' });
    });

    it('returns the matching placeholder route for a known module', () => {
        expect(matchRoute('/live/rooms')).toMatchObject({ title: '直播间管理', kind: 'placeholder' });
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
});
