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
            records: [{
                id: 9,
                userCode: 'U0009',
                realName: '测试医生',
                mobile: '13800138000',
                hospitalName: '协和医院',
                deptName: '心内科',
                identityType: 'DOCTOR',
                status: 1,
            }],
            total: 1,
            size: 20,
            current: 1,
            pages: 1,
        });

        const page = document.createElement('user-management-page');
        document.body.append(page);

        await vi.waitFor(() => expect(page.textContent).toContain('测试医生'));
        expect(page.textContent).toContain('13800138000');
        expect(page.textContent).toContain('协和医院 / 心内科');
        expect(page.textContent).toContain('封禁');
        expect(page.querySelector('[data-detail="9"]')).not.toBeNull();
    });

    it('shows the complete profile and isolates an unavailable credential file', async () => {
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
            nickname: '医路同行',
            mobile: '13800138000',
            headerId: 101,
            hospitalId: 2,
            deptId: 3,
            hospitalName: '协和医院',
            deptName: '心内科',
            identityType: 'DOCTOR',
            doctorCertNo: 'DOC-2026-0009',
            idCardNo: '110101199001011234',
            doctorCertFileId: 102,
            idCardFrontFileId: 103,
            idCardBackFileId: 104,
            status: 1,
        });
        vi.spyOn(managementApi, 'file').mockImplementation(async (id) => {
            if (id === 104) throw new Error('file missing');
            if (id === 102) {
                return { id, fileName: 'doctor-cert.pdf', fileUrl: '/uploads/doctor-cert.pdf', mimeType: 'application/pdf' };
            }
            return { id, fileName: `${id}.jpg`, fileUrl: `/uploads/${id}.jpg`, mimeType: 'image/jpeg' };
        });
        const page = document.createElement('user-management-page');
        document.body.append(page);
        await vi.waitFor(() => expect(page.querySelector('[data-detail="9"]')).not.toBeNull());

        page.querySelector<HTMLButtonElement>('[data-detail="9"]')?.click();

        const dialog = await vi.waitFor(() => {
            const value = page.querySelector('dialog');
            expect(value?.textContent).toContain('协和医院');
            expect(value?.textContent).toContain('文件不可用');
            return value;
        });
        expect(dialog?.textContent).toContain('心内科');
        expect(dialog?.textContent).toContain('13800138000');
        expect(dialog?.textContent).toContain('DOC-2026-0009');
        expect(dialog?.textContent).toContain('110101199001011234');
        expect(dialog?.querySelector('img[src="/uploads/101.jpg"]')).not.toBeNull();
        expect(dialog?.querySelector('a[href="/uploads/doctor-cert.pdf"]')).not.toBeNull();
        expect(dialog?.textContent).not.toContain('医院 ID');
        expect(dialog?.textContent).not.toContain('科室 ID');
    });
});
