// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { liveApi } from '../api/live';
import { ApiError } from '../api/http';
import { managementApi } from '../api/management';
import { sessionStore } from '../auth/session';
import './live-management-page';
import type { LiveManagementPage } from './live-management-page';

describe('live-management-page', () => {
    beforeEach(() => {
        vi.spyOn(liveApi, 'departments').mockResolvedValue([
            { id: 3, deptName: '心内科', sortNo: 1, status: 1 },
            { id: 4, deptName: '神经内科', sortNo: 2, status: 1 },
        ]);
        vi.spyOn(liveApi, 'diseases').mockResolvedValue([]);
        vi.spyOn(liveApi, 'liveRuntime').mockRejectedValue(new ApiError(404, 'Not Found'));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.location.hash = '';
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
        expect(page.querySelector('[data-action="push"]')).not.toBeNull();
        expect(page.querySelector('[data-action="watch"]')).not.toBeNull();
        expect(page.textContent).toContain('待接入');
    });

    it('shows department and disease names in the room list without duplicate disease requests', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [
                { id: 5, roomCode: 'LR5', title: '病例一', departmentId: 3, diseaseId: 7, isTop: 0, status: 1 },
                { id: 6, roomCode: 'LR6', title: '病例二', departmentId: 3, diseaseId: 8, isTop: 0, status: 1 },
            ],
            total: 2, size: 20, current: 1, pages: 1,
        });
        const diseases = vi.mocked(liveApi.diseases);
        diseases.mockResolvedValue([
            { id: 7, deptId: 3, diseaseName: '冠心病', sortNo: 1, status: 1 },
            { id: 8, deptId: 3, diseaseName: '心律失常', sortNo: 2, status: 1 },
        ]);
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);

        await page.update();

        expect(page.textContent).toContain('心内科 / 冠心病');
        expect(page.textContent).toContain('心内科 / 心律失常');
        expect(page.textContent).not.toContain('3 / 7');
        expect(diseases).toHaveBeenCalledTimes(1);
        expect(diseases).toHaveBeenCalledWith(3);
    });

    it('shows readable placeholders for unbound and missing catalog records', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [
                { id: 5, roomCode: 'LR5', title: '未分类', isTop: 0, status: 1 },
                { id: 6, roomCode: 'LR6', title: '历史关联', departmentId: 99, diseaseId: 88, isTop: 0, status: 1 },
            ],
            total: 2, size: 20, current: 1, pages: 1,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);

        await page.update();

        const rows = page.querySelectorAll<HTMLTableRowElement>('tbody tr');
        expect(rows[0].children[2].textContent).toBe('—');
        expect(rows[1].children[2].textContent).toBe('未知科室 / 未知疾病');
        expect(rows[1].children[2].textContent).not.toMatch(/99|88/);
    });

    it('selects an administrator owner by real name and submits its id', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '手术直播', ownerAdminId: 1, isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        vi.spyOn(managementApi, 'admins').mockResolvedValue({
            records: [
                { id: 1, username: 'iris', realName: '艾瑞丝', status: 1 },
                { id: 9, username: 'host', realName: '直播管理员', status: 1 },
            ],
            total: 2, size: 200, current: 1, pages: 1,
        });
        const changeOwner = vi.spyOn(liveApi, 'changeRoomOwner').mockResolvedValue(true);
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="owner"]')!.click();
        await vi.waitFor(() => expect(page.textContent).toContain('直播管理员（host）'));
        const owner = page.querySelector<HTMLSelectElement>('dialog [name="ownerId"]')!;
        expect(owner.tagName).toBe('SELECT');
        owner.value = '9';
        page.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );

        await vi.waitFor(() => expect(changeOwner).toHaveBeenCalledWith(5, undefined, 9));
    });

    it('loads every administrator page before building owner options', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '手术直播', ownerAdminId: 1, isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        const admins = vi.spyOn(managementApi, 'admins').mockImplementation(async (query) => ({
            records: query.page === 2
                ? [{ id: 201, username: 'later', realName: '后页管理员', status: 1 }]
                : [{ id: 1, username: 'iris', realName: '艾瑞丝', status: 1 }],
            total: 201, size: 200, current: Number(query.page), pages: 2,
        }));
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="owner"]')!.click();

        await vi.waitFor(() => expect(page.textContent).toContain('后页管理员（later）'));
        expect(admins).toHaveBeenCalledWith({ page: 2, size: 200 });
    });

    it('selects a user owner by nickname and submits its id', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '病例直播', ownerUserId: 12, isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        vi.spyOn(managementApi, 'users').mockResolvedValue({
            records: [{ id: 12, userCode: 'U012', realName: '张医生', nickname: '心内张医生', status: 1 }],
            total: 1, size: 200, current: 1, pages: 1,
        });
        const changeOwner = vi.spyOn(liveApi, 'changeRoomOwner').mockResolvedValue(true);
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="owner"]')!.click();
        await vi.waitFor(() => expect(page.textContent).toContain('心内张医生（张医生）'));
        const owner = page.querySelector<HTMLSelectElement>('dialog [name="ownerId"]')!;
        expect(owner.value).toBe('12');
        page.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );

        await vi.waitFor(() => expect(changeOwner).toHaveBeenCalledWith(5, 12, undefined));
    });

    it('reloads candidates on owner type change and falls back to real name and user code', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '病例直播', ownerAdminId: 1, isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        vi.spyOn(managementApi, 'admins').mockResolvedValue({
            records: [{ id: 1, username: 'iris', realName: '艾瑞丝', status: 1 }],
            total: 1, size: 200, current: 1, pages: 1,
        });
        const users = vi.spyOn(managementApi, 'users').mockResolvedValue({
            records: [{ id: 12, userCode: 'U012', realName: '张医生', nickname: null, status: 1 }],
            total: 1, size: 200, current: 1, pages: 1,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();
        page.querySelector<HTMLButtonElement>('[data-action="owner"]')!.click();
        await vi.waitFor(() => expect(page.textContent).toContain('艾瑞丝（iris）'));

        const ownerType = page.querySelector<HTMLSelectElement>('dialog [name="ownerType"]')!;
        ownerType.value = 'user';
        ownerType.dispatchEvent(new Event('change', { bubbles: true }));

        await vi.waitFor(() => expect(page.textContent).toContain('张医生（U012）'));
        expect(users).toHaveBeenCalledWith({ page: 1, size: 200 });
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

    it('queries the selected active stream when the runtime API is available', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.mocked(liveApi.liveRuntime).mockResolvedValue({
            roomId: 5, liveConfigId: 1, activeStreamId: 12, appName: 'medi-stream',
            pushDomain: 'push.example.com', playDomain: 'live.example.com', expireAtEpochSeconds: 2_000_000_000,
            streams: [],
        });
        vi.spyOn(liveApi, 'roomStreamState').mockResolvedValue({ Response: { LiveStreamState: 'active' } });
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);

        await page.update();

        expect(page.textContent).toContain('直播中');
        expect(liveApi.roomStreamState).toHaveBeenCalledWith(5, 12);
        expect(page.querySelector('[data-refresh-live-status]')).not.toBeNull();
    });

    it('does not open the play page when the selected stream is not live', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.mocked(liveApi.liveRuntime).mockResolvedValue({
            roomId: 5, liveConfigId: 1, activeStreamId: 12, appName: 'medi-stream',
            pushDomain: 'push.example.com', playDomain: 'live.example.com', expireAtEpochSeconds: 2_000_000_000,
            streams: [],
        });
        vi.spyOn(liveApi, 'roomStreamState').mockResolvedValue({ Response: { LiveStreamState: 'inactive' } });
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '手术直播', isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();

        page.querySelector<HTMLButtonElement>('[data-action="watch"]')!.click();

        await vi.waitFor(() => expect(page.textContent).toContain('当前直播间未开播'));
        expect(window.location.hash).not.toContain('/live/play');
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
        await vi.waitFor(() => expect(page.querySelector('dialog')).not.toBeNull());
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
        await vi.waitFor(() => expect(page.querySelector('dialog')).not.toBeNull());
        const firstStream = page.querySelector<HTMLInputElement>('[data-stream-row] [name="streamName"]')!;
        firstStream.value = 'main-stream';

        page.querySelector<HTMLButtonElement>('[data-add-stream]')!.click();

        const streams = page.querySelectorAll<HTMLInputElement>('[data-stream-row] [name="streamName"]');
        expect(streams).toHaveLength(2);
        expect(streams[0].value).toBe('main-stream');
    });

    it('increments the highest sort number when another stream is added', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [{ id: 5, roomCode: 'LR5', title: '心内科直播', isTop: 0, status: 1 }],
            total: 1, size: 20, current: 1, pages: 1,
        });
        vi.spyOn(liveApi, 'room').mockResolvedValue({
            id: 5,
            roomCode: 'LR5',
            title: '心内科直播',
            isTop: 0,
            status: 1,
            streams: [{
                id: 2,
                roomId: 5,
                streamCode: 'SR2',
                streamName: 'cardiology-main',
                sortNo: 6,
                isDefault: 1,
                status: 1,
            }],
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();
        page.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
        await vi.waitFor(() => expect(page.querySelector('dialog')).not.toBeNull());

        page.querySelector<HTMLButtonElement>('[data-add-stream]')!.click();

        const sortInputs = page.querySelectorAll<HTMLInputElement>('[data-stream-row] [name="sortNo"]');
        expect(sortInputs).toHaveLength(2);
        expect(sortInputs[1].value).toBe('7');
    });

    it('selects the broadcast date and time with controls and combines the API value', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [], total: 0, size: 20, current: 1, pages: 0,
        });
        const createRoom = vi.spyOn(liveApi, 'createRoom').mockResolvedValue({
            id: 8, roomCode: 'LR8', title: '定时直播', isTop: 0, status: 1, streams: [],
        });
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();
        page.querySelector<HTMLButtonElement>('[data-create]')!.click();
        await vi.waitFor(() => expect(page.querySelector('dialog')).not.toBeNull());
        const dialog = page.querySelector<HTMLDialogElement>('dialog')!;

        expect(dialog.textContent).toContain('开播时间');
        expect(dialog.querySelector('[type="datetime-local"]')).toBeNull();
        dialog.querySelector<HTMLInputElement>('[name="title"]')!.value = '定时直播';
        dialog.querySelector<HTMLInputElement>('[name="streamName"]')!.value = 'scheduled-main';
        dialog.querySelector<HTMLInputElement>('[name="startDate"]')!.value = '2026-07-16';
        dialog.querySelector<HTMLSelectElement>('[name="startHour"]')!.value = '09';
        dialog.querySelector<HTMLSelectElement>('[name="startMinute"]')!.value = '30';
        dialog.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );

        await vi.waitFor(() => expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
            startTime: '2026-07-16T09:30:00',
        })));
    });

    it('shows department and disease names in linked dropdowns', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(liveApi, 'rooms').mockResolvedValue({
            records: [], total: 0, size: 20, current: 1, pages: 0,
        });
        const diseases = vi.mocked(liveApi.diseases);
        diseases.mockResolvedValue([{ id: 7, deptId: 3, diseaseName: '冠心病', sortNo: 1, status: 1 }]);
        const page = document.createElement('live-management-page') as LiveManagementPage;
        document.body.append(page);
        await page.update();
        page.querySelector<HTMLButtonElement>('[data-create]')!.click();
        await vi.waitFor(() => expect(page.textContent).toContain('心内科'));

        const department = page.querySelector<HTMLSelectElement>('dialog [name="departmentId"]')!;
        expect(department.tagName).toBe('SELECT');
        expect(page.querySelector('dialog [name="diseaseId"]')?.tagName).toBe('SELECT');
        department.value = '3';
        department.dispatchEvent(new Event('change', { bubbles: true }));

        await vi.waitFor(() => expect(page.textContent).toContain('冠心病'));
        expect(diseases).toHaveBeenCalledWith(3);
        expect(page.querySelector('.file-upload-control')).not.toBeNull();
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
