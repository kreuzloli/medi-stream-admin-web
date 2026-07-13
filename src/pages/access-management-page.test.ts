// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { managementApi } from '../api/management';
import { sessionStore } from '../auth/session';
import './access-management-page';
import type { AccessManagementPage } from './access-management-page';

describe('access-management-page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('renders administrator data and management actions', async () => {
        vi.spyOn(sessionStore, 'can').mockReturnValue(true);
        vi.spyOn(managementApi, 'admins').mockResolvedValue({
            records: [{ id: 7, username: 'operator', realName: '运营管理员', status: 1 }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });
        const page = document.createElement('access-management-page') as AccessManagementPage;
        document.body.append(page);

        await page.update('admins');

        expect(page.textContent).toContain('运营管理员');
        expect(page.textContent).toContain('新增管理员');
        expect(page.querySelector('[data-action="roles"]')).not.toBeNull();
    });

    it('hides role assignment when the operator cannot read roles', async () => {
        vi.spyOn(sessionStore, 'can').mockImplementation((permission) => permission === 'ADMIN_MANAGE');
        vi.spyOn(managementApi, 'admins').mockResolvedValue({
            records: [{ id: 7, username: 'operator', realName: '运营管理员', status: 1 }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });
        const page = document.createElement('access-management-page') as AccessManagementPage;
        document.body.append(page);

        await page.update('admins');

        expect(page.querySelector('[data-action="edit"]')).not.toBeNull();
        expect(page.querySelector('[data-action="roles"]')).toBeNull();
    });

    it('hides permission assignment when the operator cannot read permissions', async () => {
        vi.spyOn(sessionStore, 'can').mockImplementation((permission) => permission === 'ROLE_MANAGE');
        vi.spyOn(managementApi, 'roles').mockResolvedValue([{
            id: 3,
            roleCode: 'OPERATOR',
            roleName: '运营角色',
            status: 1,
        }]);
        const page = document.createElement('access-management-page') as AccessManagementPage;
        document.body.append(page);

        await page.update('roles');

        expect(page.querySelector('[data-action="edit"]')).not.toBeNull();
        expect(page.querySelector('[data-action="permissions"]')).toBeNull();
    });
});
