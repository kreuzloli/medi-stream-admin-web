// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { managementApi } from '../api/management';
import { sessionStore } from '../auth/session';
import './user-management-page';

describe('user-management-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('renders user records returned by the management API', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(managementApi, 'users').mockResolvedValue({
            records: [{ id: 9, userCode: 'U0009', realName: '测试医生', identityType: 'DOCTOR', status: 1 }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });

        const page = document.createElement('user-management-page');
        document.body.append(page);

        await vi.waitFor(() => expect(page.textContent).toContain('测试医生'));
        expect(page.textContent).toContain('封禁');
        expect(page.querySelector('[data-detail="9"]')).not.toBeNull();
    });

    it('shows hospital and department names in user details without exposing ids', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(managementApi, 'users').mockResolvedValue({
            records: [{ id: 9, userCode: 'U0009', realName: '测试医生', status: 1 }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });
        vi.spyOn(managementApi, 'user').mockResolvedValue({
            id: 9,
            userCode: 'U0009',
            realName: '测试医生',
            hospitalId: 2,
            deptId: 3,
            hospitalName: '协和医院',
            deptName: '心内科',
            status: 1,
        });
        const page = document.createElement('user-management-page');
        document.body.append(page);
        await vi.waitFor(() => expect(page.querySelector('[data-detail="9"]')).not.toBeNull());

        page.querySelector<HTMLButtonElement>('[data-detail="9"]')?.click();

        const dialog = await vi.waitFor(() => {
            const value = page.querySelector('dialog');
            expect(value?.textContent).toContain('协和医院');
            return value;
        });
        expect(dialog?.textContent).toContain('心内科');
        expect(dialog?.textContent).not.toContain('医院 ID');
        expect(dialog?.textContent).not.toContain('科室 ID');
    });
});
