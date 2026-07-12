import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJson } from './http';

describe('requestJson', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('adds a bearer token and parses JSON', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ username: 'admin' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(requestJson('/auth/me', { token: 'jwt-token' })).resolves.toEqual({ username: 'admin' });
        expect(fetchMock).toHaveBeenCalledWith('/admin/api/auth/me', expect.objectContaining({
            headers: expect.any(Headers),
        }));
        const headers = fetchMock.mock.calls[0][1].headers as Headers;
        expect(headers.get('Authorization')).toBe('Bearer jwt-token');
    });

    it('throws an ApiError using the backend message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ code: 401, message: '用户名或密码错误' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }),
        ));

        await expect(requestJson('/auth/login')).rejects.toEqual(
            expect.objectContaining({ status: 401, message: '用户名或密码错误' }),
        );
    });
});
