import { managementApi } from '../api/management';
import { sessionStore } from '../auth/session';
import type { UserInfo } from '../types';
import {
    emptyRows,
    errorMessage,
    escapeHtml,
    formValue,
    formatDate,
    loadingRows,
    openDialog,
    statusBadge,
} from './management-shared';

/** 普通用户管理页，提供筛选、分页、详情以及封禁/解封操作。 */
export class UserManagementPage extends HTMLElement {
    private records: UserInfo[] = [];
    private page = 1;
    private total = 0;
    private loading = false;
    private error = '';
    private notice = '';
    private filters = { userCode: '', realName: '', identityType: '', status: '' };

    /** 组件挂载后加载首屏用户数据。 */
    connectedCallback(): void {
        void this.load();
    }

    /** 使用当前筛选和页码加载用户分页，并统一维护加载与错误状态。 */
    private async load(): Promise<void> {
        this.loading = true;
        this.error = '';
        this.render();
        try {
            const result = await managementApi.users({ page: this.page, size: 20, ...this.filters });
            this.records = result.records;
            this.total = result.total;
        } catch (error) {
            this.error = errorMessage(error);
        } finally {
            this.loading = false;
            this.render();
        }
    }

    /** 渲染用户筛选、分页和权限受控的账号状态操作。 */
    private render(): void {
        const canManage = sessionStore.can('USER_MANAGE');
        const rows = this.loading ? loadingRows(7) : this.records.length === 0 ? emptyRows(7) : this.records.map((user) => `
            <tr>
                <td><div class="primary-cell"><strong>${escapeHtml(user.realName)}</strong><small>${escapeHtml(user.userCode || `ID ${user.id}`)}</small></div></td>
                <td>${escapeHtml(user.nickname || '—')}</td>
                <td>${escapeHtml(user.identityType || '—')}</td>
                <td>${user.hospitalId ?? '—'}</td>
                <td>${statusBadge(user.status)}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td class="row-actions"><button type="button" data-detail="${user.id}">详情</button>${canManage ? `<button type="button" data-status="${user.id}">${user.status === 1 ? '封禁' : '解封'}</button>` : ''}</td>
            </tr>`).join('');
        const pages = Math.max(1, Math.ceil(this.total / 20));
        this.innerHTML = `
            <section class="management-page">
                <div class="management-titlebar"><div><h2>用户账号</h2><p>查询平台注册用户并管理账号可用状态</p></div></div>
                ${this.notice ? `<div class="page-notice success">${escapeHtml(this.notice)}</div>` : ''}
                ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}<button type="button" data-retry>重试</button></div>` : ''}
                <form class="filter-bar user-filters" data-filter>
                    <label>用户编码<input name="userCode" value="${escapeHtml(this.filters.userCode)}" placeholder="输入用户编码" /></label>
                    <label>姓名<input name="realName" value="${escapeHtml(this.filters.realName)}" placeholder="输入姓名" /></label>
                    <label>身份类型<input name="identityType" value="${escapeHtml(this.filters.identityType)}" placeholder="例如 DOCTOR" /></label>
                    <label>状态<select name="status"><option value="">全部状态</option><option value="1" ${this.filters.status === '1' ? 'selected' : ''}>正常</option><option value="0" ${this.filters.status === '0' ? 'selected' : ''}>封禁</option></select></label>
                    <button class="secondary-button" type="submit">查询</button><button class="text-button" type="reset" data-reset>重置</button>
                </form>
                <div class="data-panel"><div class="table-scroll"><table><thead><tr><th>用户</th><th>昵称</th><th>身份类型</th><th>医院 ID</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
                <div class="pagination"><span>共 ${this.total} 条</span><button type="button" data-page="prev" ${this.page <= 1 ? 'disabled' : ''}>上一页</button><b>${this.page} / ${pages}</b><button type="button" data-page="next" ${this.page >= pages ? 'disabled' : ''}>下一页</button></div>
            </section>`;
        this.bindEvents(canManage);
    }

    /** 绑定筛选、分页和详情事件；封禁操作只对有管理权限的用户开放。 */
    private bindEvents(canManage: boolean): void {
        this.querySelector('[data-retry]')?.addEventListener('click', () => void this.load());
        this.querySelector<HTMLFormElement>('[data-filter]')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            this.filters = {
                userCode: formValue(data, 'userCode'),
                realName: formValue(data, 'realName'),
                identityType: formValue(data, 'identityType'),
                status: formValue(data, 'status'),
            };
            this.page = 1;
            void this.load();
        });
        this.querySelector('[data-reset]')?.addEventListener('click', () => {
            this.filters = { userCode: '', realName: '', identityType: '', status: '' };
            this.page = 1;
            void this.load();
        });
        this.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => button.addEventListener('click', () => {
            this.page += button.dataset.page === 'next' ? 1 : -1;
            void this.load();
        }));
        this.querySelectorAll<HTMLButtonElement>('[data-detail]').forEach((button) => button.addEventListener('click', () => void this.openDetail(Number(button.dataset.detail))));
        if (canManage) this.querySelectorAll<HTMLButtonElement>('[data-status]').forEach((button) => button.addEventListener('click', () => void this.changeStatus(Number(button.dataset.status))));
    }

    /** 加载用户详情并以医院、科室名称展示关联信息，不向页面暴露关联 ID。 */
    private async openDetail(id: number): Promise<void> {
        try {
            const user = await managementApi.user(id);
            openDialog(this, `<article class="dialog-card user-detail"><header><div><h3>用户详情</h3><p>${escapeHtml(user.userCode || `ID ${user.id}`)}</p></div><button type="button" class="dialog-close" data-close>×</button></header><dl>
                <div><dt>姓名</dt><dd>${escapeHtml(user.realName)}</dd></div><div><dt>昵称</dt><dd>${escapeHtml(user.nickname || '—')}</dd></div>
                <div><dt>身份类型</dt><dd>${escapeHtml(user.identityType || '—')}</dd></div><div><dt>状态</dt><dd>${statusBadge(user.status)}</dd></div>
                <div><dt>医院</dt><dd>${escapeHtml(user.hospitalName || '—')}</dd></div><div><dt>科室</dt><dd>${escapeHtml(user.deptName || '—')}</dd></div>
                <div><dt>创建时间</dt><dd>${formatDate(user.createdAt)}</dd></div><div><dt>更新时间</dt><dd>${formatDate(user.updatedAt)}</dd></div>
            </dl><footer><button type="button" class="secondary-button" data-close>关闭</button></footer></article>`);
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    /** 二次确认后封禁或解封用户，并刷新当前分页。 */
    private async changeStatus(id: number): Promise<void> {
        const user = this.records.find((item) => item.id === id);
        if (!user) return;
        const status = user.status === 1 ? 0 : 1;
        if (!window.confirm(`确认${status === 1 ? '解封' : '封禁'}用户“${user.realName}”？`)) return;
        try {
            await managementApi.setUserStatus(id, status);
            this.notice = status === 1 ? '用户已解封' : '用户已封禁';
            await this.load();
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }
}

customElements.define('user-management-page', UserManagementPage);
