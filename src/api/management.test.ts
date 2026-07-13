// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionStore } from '../auth/session';
import { logger } from '../common/logger';
import { managementApi } from './management';

describe('managementApi', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('loads assigned administrator roles with the current token', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ids: [1, 2] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(managementApi.adminRoleIds(8)).resolves.toEqual({ ids: [1, 2] });
        expect(fetchMock).toHaveBeenCalledWith('/admin/api/admins/8/roles', expect.objectContaining({
            headers: expect.any(Headers),
        }));
        expect((fetchMock.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer admin-token');
    });

    it('replaces role permissions using the backend ids payload', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await managementApi.replaceRolePermissions(3, [10, 11]);

        expect(fetchMock).toHaveBeenCalledWith('/admin/api/roles/3/permissions', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ ids: [10, 11] }),
        }));
    });

    it('clears the session and returns to login when the token is rejected', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('expired-token');
        const clearSession = vi.spyOn(sessionStore, 'clear');
        window.location.hash = '#/access/roles';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: 'Token已失效',
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(managementApi.roles()).rejects.toMatchObject({ status: 401 });

        expect(clearSession).toHaveBeenCalledOnce();
        expect(window.location.hash).toBe('#/login');
    });

    it('logs failed requests without including the token or request body', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('sensitive-token');
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: '服务异常',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(managementApi.createRole({
            roleCode: 'OPERATOR',
            roleName: '运营角色',
            status: 1,
        })).rejects.toMatchObject({ status: 500 });

        expect(warn).toHaveBeenCalledWith('management api request failed', {
            method: 'POST',
            path: '/roles',
            status: 500,
        });
        expect(JSON.stringify(warn.mock.calls)).not.toContain('sensitive-token');
        expect(JSON.stringify(warn.mock.calls)).not.toContain('OPERATOR');
    });
});
