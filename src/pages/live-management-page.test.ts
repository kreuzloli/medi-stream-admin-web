// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { liveApi } from '../api/live';
import { sessionStore } from '../auth/session';
import './live-management-page';
import type { LiveManagementPage } from './live-management-page';

describe('live-management-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('renders live rooms and management actions', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{
                id: 5,
                roomCode: 'LR5',
                title: '心内科直播',
                ownerAdminId: 1,
                isTop: 1,
                status: 1,
            }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);

        await page.update();

        expect(page.textContent).toContain('心内科直播');
        expect(page.textContent).toContain('LR5');
        expect(page.querySelector('[data-create]')).not.toBeNull();
        expect(page.querySelector('[data-action="edit"]')).not.toBeNull();
    });

    it('keeps the page read-only without LIVE_MANAGE', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(false);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [], total: 0, size: 20, current: 1, pages: 0,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);

        await page.update();

        expect(page.querySelector('[data-create]')).toBeNull();
        expect(page.textContent).toContain('暂无直播间');
    });

    it('creates a room from the composite room and stream editor', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [], total: 0, size: 20, current: 1, pages: 0,
        });
        const createRoom = vi.spyOn(liveApi, 'createRoom').mockResolvedValue({
            id: 8, roomCode: 'LR8', title: '新直播', isTop: 0, status: 1, streams: [],
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-create]')!.click();
        const dialog = page.querySelector<HTMLDialogElement>('dialog')!;
        expect(dialog.querySelectorAll('[data-stream-row]')).toHaveLength(1);
        dialog.querySelector<HTMLInputElement>('[name="title"]')!.value = '新直播';
        dialog.querySelector<HTMLInputElement>('[name="streamName"]')!.value = 'new-main';
        dialog.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );

        await vi.waitFor(() => expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
            title: '新直播',
            streams: [expect.objectContaining({ streamName: 'new-main', isDefault: 1 })],
        })));
    });

    it('preserves entered stream values when another stream is added', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [], total: 0, size: 20, current: 1, pages: 0,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();
        page.querySelector<HTMLButtonElement>('[data-create]')!.click();
        const firstStream = page.querySelector<HTMLInputElement>('[data-stream-row] [name="streamName"]')!;
        firstStream.value = 'main-stream';

        page.querySelector<HTMLButtonElement>('[data-add-stream]')!.click();

        const streams = page.querySelectorAll<HTMLInputElement>('[data-stream-row] [name="streamName"]');
        expect(streams).toHaveLength(2);
        expect(streams[0].value).toBe('main-stream');
    });

    it('loads room details before opening the edit dialog', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '心内科直播', isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5,
            roomCode: 'LR5',
            title: '心内科直播',
            description: '病例讨论',
            coverFileId: 12,
            isTop: 0,
            status: 1,
            streams: [{
                id: 2,
                roomId: 5,
                streamCode: 'SR2',
                streamName: 'cardiology-main',
                sortNo: 0,
                isDefault: 1,
                status: 1,
            }],
        });
        vi.spyOn(liveApi, 'file').mockResolvedValue({ id: 12, fileName: 'cover.png', fileUrl: '/uploads/cover.png' });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
        await vi.waitFor(() => expect(page.querySelector<HTMLInputElement>('[name="streamName"]')?.value)
            .toBe('cardiology-main'));

        expect(page.querySelector<HTMLInputElement>('dialog [name="title"]')?.value).toBe('心内科直播');
        expect(page.textContent).toContain('cover.png');
    });

    it('updates the top flag from the row action', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '心内科直播', isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        const setTop = vi.spyOn(liveApi, 'setRoomTop').mockResolvedValue(true);
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="top"]')!.click();

        await vi.waitFor(() => expect(setTop).toHaveBeenCalledWith(5, 1));
    });
});
