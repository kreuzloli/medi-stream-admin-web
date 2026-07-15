// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionStore } from '../auth/session';
import { liveApi } from './live';

describe('liveApi', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('uploads a file as multipart without overriding the browser content type', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const uploaded = { id: 12, fileName: 'cover.png', fileUrl: '/uploads/cover.png' };
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(uploaded), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(liveApi.uploadFile(new File(['cover'], 'cover.png', { type: 'image/png' })))
            .resolves.toEqual(uploaded);

        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/api/files/upload');
        expect(options.body).toBeInstanceOf(FormData);
        expect((options.headers as Headers).get('Content-Type')).toBeNull();
        expect((options.headers as Headers).get('Authorization')).toBe('Bearer admin-token');
    });

    it('creates a room with the composite streams payload', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: 9,
            roomCode: 'LR9',
            title: '手术直播',
            streams: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);
        const input = {
            title: '手术直播',
            status: 1,
            isTop: 0,
            streams: [{ streamName: 'operation-main', isDefault: 1, status: 1 }],
        };

        await liveApi.createRoom(input);

        expect(fetchMock).toHaveBeenCalledWith('/admin/api/live-rooms', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input),
        }));
    });

    it('encodes Tencent URL generation query parameters', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ streamName: 'main' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await liveApi.generateUrls({ streamName: 'main', ttlSeconds: 3600, transcodeTemplate: 'hd' });

        expect(fetchMock.mock.calls[0][0]).toBe(
            '/admin/api/tencent-live/urls?streamName=main&ttlSeconds=3600&transcodeTemplate=hd',
        );
    });

    it('loads catalog names and filters diseases by department', async () => {
        vi.spyOn(sessionStore, 'accessToken', 'get').mockReturnValue('admin-token');
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 3, deptName: '心内科', status: 1 }]), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 7, deptId: 3, diseaseName: '冠心病', status: 1 }]), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', fetchMock);

        await liveApi.departments();
        await liveApi.diseases(3);

        expect(fetchMock.mock.calls[0][0]).toBe('/admin/api/departments');
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/api/diseases?deptId=3');
    });
});
