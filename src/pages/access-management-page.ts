import { managementApi, type AdminInput, type PermissionInput, type RoleInput } from '../api/management';
import { sessionStore } from '../auth/session';
import type { Administrator, Permission, Role } from '../types';
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

export type AccessPageKind = 'admins' | 'roles' | 'permissions';

const pageMeta = {
    admins: { title: '管理员账号', description: '维护后台登录账号、状态和角色范围', permission: 'ADMIN_MANAGE', create: '新增管理员' },
    roles: { title: '角色管理', description: '定义岗位角色并配置可访问的功能权限', permission: 'ROLE_MANAGE', create: '新增角色' },
    permissions: { title: '权限定义', description: '维护后端接口使用的权限代码和资源说明', permission: 'PERMISSION_MANAGE', create: '新增权限' },
} as const;

/** RBAC 管理页面，按路由展示管理员、角色或权限列表及编辑操作。 */
export class AccessManagementPage extends HTMLElement {
    private kind: AccessPageKind = 'admins';
    private admins: Administrator[] = [];
    private roles: Role[] = [];
    private permissions: Permission[] = [];
    private loading = false;
    private error = '';
    private notice = '';
    private adminFilters = { username: '', status: '' };
    private adminPage = 1;
    private adminTotal = 0;

    async update(kind: AccessPageKind): Promise<void> {
        this.kind = kind;
        this.notice = '';
        await this.load();
    }

    private async load(): Promise<void> {
        this.loading = true;
        this.error = '';
        this.render();
        try {
            if (this.kind === 'admins') {
                const result = await managementApi.admins({
                    page: this.adminPage,
                    size: 20,
                    username: this.adminFilters.username,
                    status: this.adminFilters.status,
                });
                this.admins = result.records;
                this.adminTotal = result.total;
            } else if (this.kind === 'roles') {
                this.roles = await managementApi.roles();
            } else {
                this.permissions = await managementApi.permissions();
            }
        } catch (error) {
            this.error = errorMessage(error);
        } finally {
            this.loading = false;
            this.render();
        }
    }

    private render(): void {
        const meta = pageMeta[this.kind];
        const canManage = sessionStore.can(meta.permission);
        const canAssignRoles = canManage && sessionStore.can('ROLE_VIEW');
        const canAssignPermissions = canManage && sessionStore.can('PERMISSION_VIEW');
        this.innerHTML = `
            <section class="management-page">
                <div class="management-titlebar">
                    <div><h2>${meta.title}</h2><p>${meta.description}</p></div>
                    ${canManage ? `<button class="primary-button" type="button" data-create>＋ ${meta.create}</button>` : ''}
                </div>
                ${this.notice ? `<div class="page-notice success">${escapeHtml(this.notice)}</div>` : ''}
                ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}<button type="button" data-retry>重试</button></div>` : ''}
                ${this.kind === 'admins' ? this.renderAdminFilters() : ''}
                <div class="data-panel">
                    ${this.kind === 'admins' ? this.renderAdmins(canManage, canAssignRoles) : this.kind === 'roles' ? this.renderRoles(canManage, canAssignPermissions) : this.renderPermissions(canManage)}
                </div>
                ${this.kind === 'admins' ? this.renderPagination() : ''}
            </section>`;
        this.bindEvents(canManage);
    }

    private renderAdminFilters(): string {
        return `
            <form class="filter-bar" data-filter>
                <label>用户名<input name="username" value="${escapeHtml(this.adminFilters.username)}" placeholder="输入用户名" /></label>
                <label>状态<select name="status"><option value="">全部状态</option><option value="1" ${this.adminFilters.status === '1' ? 'selected' : ''}>启用</option><option value="0" ${this.adminFilters.status === '0' ? 'selected' : ''}>停用</option></select></label>
                <button class="secondary-button" type="submit">查询</button>
                <button class="text-button" type="reset" data-reset-filter>重置</button>
            </form>`;
    }

    private renderAdmins(canManage: boolean, canAssignRoles: boolean): string {
        const rows = this.loading ? loadingRows(6) : this.admins.length === 0 ? emptyRows(6) : this.admins.map((admin) => `
            <tr>
                <td><div class="primary-cell"><strong>${escapeHtml(admin.username)}</strong><small>ID ${admin.id}</small></div></td>
                <td>${escapeHtml(admin.realName)}</td>
                <td>${statusBadge(admin.status)}</td>
                <td>${formatDate(admin.lastLoginAt)}</td>
                <td>${formatDate(admin.createdAt)}</td>
                <td class="row-actions">${canManage ? `
                    ${canAssignRoles ? `<button type="button" data-action="roles" data-id="${admin.id}">角色</button>` : ''}
                    <button type="button" data-action="edit" data-id="${admin.id}">编辑</button>
                    <button type="button" data-action="password" data-id="${admin.id}">重置密码</button>
                    <button type="button" data-action="status" data-id="${admin.id}">${admin.status === 1 ? '停用' : '启用'}</button>
                    <button type="button" class="danger" data-action="delete" data-id="${admin.id}">删除</button>` : '—'}</td>
            </tr>`).join('');
        return `<div class="table-scroll"><table><thead><tr><th>账号</th><th>姓名</th><th>状态</th><th>最后登录</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    private renderRoles(canManage: boolean, canAssignPermissions: boolean): string {
        const rows = this.loading ? loadingRows(5) : this.roles.length === 0 ? emptyRows(5) : this.roles.map((role) => `
            <tr><td><div class="primary-cell"><strong>${escapeHtml(role.roleName)}</strong><small>${escapeHtml(role.roleCode)}</small></div></td><td>${escapeHtml(role.description || '—')}</td><td>${statusBadge(role.status)}</td><td>${role.id}</td><td class="row-actions">${canManage ? `
                ${canAssignPermissions ? `<button type="button" data-action="permissions" data-id="${role.id}">配置权限</button>` : ''}
                <button type="button" data-action="edit" data-id="${role.id}">编辑</button>
                <button type="button" data-action="status" data-id="${role.id}">${role.status === 1 ? '停用' : '启用'}</button>
                <button type="button" class="danger" data-action="delete" data-id="${role.id}">删除</button>` : '—'}</td></tr>`).join('');
        return `<div class="table-scroll"><table><thead><tr><th>角色</th><th>说明</th><th>状态</th><th>ID</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    private renderPermissions(canManage: boolean): string {
        const rows = this.loading ? loadingRows(6) : this.permissions.length === 0 ? emptyRows(6) : this.permissions.map((permission) => `
            <tr><td><code>${escapeHtml(permission.permissionCode)}</code></td><td>${escapeHtml(permission.permissionName)}</td><td>${escapeHtml(permission.resourceType || '—')}</td><td>${escapeHtml(permission.description || '—')}</td><td>${statusBadge(permission.status)}</td><td class="row-actions">${canManage ? `
                <button type="button" data-action="edit" data-id="${permission.id}">编辑</button>
                <button type="button" data-action="status" data-id="${permission.id}">${permission.status === 1 ? '停用' : '启用'}</button>
                <button type="button" class="danger" data-action="delete" data-id="${permission.id}">删除</button>` : '—'}</td></tr>`).join('');
        return `<div class="table-scroll"><table><thead><tr><th>权限代码</th><th>名称</th><th>资源类型</th><th>说明</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    private renderPagination(): string {
        const pages = Math.max(1, Math.ceil(this.adminTotal / 20));
        return `<div class="pagination"><span>共 ${this.adminTotal} 条</span><button type="button" data-page="prev" ${this.adminPage <= 1 ? 'disabled' : ''}>上一页</button><b>${this.adminPage} / ${pages}</b><button type="button" data-page="next" ${this.adminPage >= pages ? 'disabled' : ''}>下一页</button></div>`;
    }

    private bindEvents(canManage: boolean): void {
        this.querySelector('[data-retry]')?.addEventListener('click', () => void this.load());
        this.querySelector<HTMLFormElement>('[data-filter]')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            this.adminFilters = { username: formValue(data, 'username'), status: formValue(data, 'status') };
            this.adminPage = 1;
            void this.load();
        });
        this.querySelector('[data-reset-filter]')?.addEventListener('click', () => {
            this.adminFilters = { username: '', status: '' };
            this.adminPage = 1;
            void this.load();
        });
        this.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => button.addEventListener('click', () => {
            this.adminPage += button.dataset.page === 'next' ? 1 : -1;
            void this.load();
        }));
        if (!canManage) return;
        this.querySelector('[data-create]')?.addEventListener('click', () => this.openEditor());
        this.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
            button.addEventListener('click', () => void this.handleAction(button.dataset.action ?? '', Number(button.dataset.id)));
        });
    }

    private async handleAction(action: string, id: number): Promise<void> {
        if (action === 'edit') return this.openEditor(id);
        if (action === 'roles') return this.openAdminRoles(id);
        if (action === 'permissions') return this.openRolePermissions(id);
        if (action === 'password') return this.openPassword(id);
        const record = this.kind === 'admins' ? this.admins.find((item) => item.id === id)
            : this.kind === 'roles' ? this.roles.find((item) => item.id === id)
                : this.permissions.find((item) => item.id === id);
        if (!record) return;
        if (action === 'status') {
            const status = record.status === 1 ? 0 : 1;
            if (!window.confirm(`确认${status === 1 ? '启用' : '停用'}该记录？`)) return;
            await this.run(async () => {
                if (this.kind === 'admins') await managementApi.setAdminStatus(id, status);
                else if (this.kind === 'roles') await managementApi.setRoleStatus(id, status);
                else await managementApi.setPermissionStatus(id, status);
            }, '状态已更新');
        }
        if (action === 'delete') {
            if (!window.confirm('删除后无法恢复，确认继续？')) return;
            await this.run(async () => {
                if (this.kind === 'admins') await managementApi.deleteAdmin(id);
                else if (this.kind === 'roles') await managementApi.deleteRole(id);
                else await managementApi.deletePermission(id);
            }, '记录已删除');
        }
    }

    private openEditor(id?: number): void {
        if (this.kind === 'admins') {
            const value = this.admins.find((item) => item.id === id);
            const dialog = openDialog(this, this.dialogShell(id ? '编辑管理员' : '新增管理员', `
                <label>用户名<input name="username" required value="${escapeHtml(value?.username)}" /></label>
                <label>姓名<input name="realName" required value="${escapeHtml(value?.realName)}" /></label>
                ${id ? '' : '<label>初始密码<input name="password" type="password" required minlength="8" /></label>'}
                ${this.statusSelect(value?.status ?? 1)}`));
            this.bindDialogSubmit(dialog, async (data) => {
                const input: AdminInput = { username: formValue(data, 'username'), realName: formValue(data, 'realName'), status: Number(formValue(data, 'status')) };
                const password = formValue(data, 'password');
                if (password) input.password = password;
                if (id) await managementApi.updateAdmin(id, input); else await managementApi.createAdmin(input);
            });
            return;
        }
        if (this.kind === 'roles') {
            const value = this.roles.find((item) => item.id === id);
            const dialog = openDialog(this, this.dialogShell(id ? '编辑角色' : '新增角色', `
                <label>角色代码<input name="roleCode" required value="${escapeHtml(value?.roleCode)}" /></label>
                <label>角色名称<input name="roleName" required value="${escapeHtml(value?.roleName)}" /></label>
                <label class="span-2">说明<textarea name="description">${escapeHtml(value?.description)}</textarea></label>
                ${this.statusSelect(value?.status ?? 1)}`));
            this.bindDialogSubmit(dialog, async (data) => {
                const input: RoleInput = { roleCode: formValue(data, 'roleCode'), roleName: formValue(data, 'roleName'), description: formValue(data, 'description'), status: Number(formValue(data, 'status')) };
                if (id) await managementApi.updateRole(id, input); else await managementApi.createRole(input);
            });
            return;
        }
        const value = this.permissions.find((item) => item.id === id);
        const dialog = openDialog(this, this.dialogShell(id ? '编辑权限' : '新增权限', `
            <label>权限代码<input name="permissionCode" required value="${escapeHtml(value?.permissionCode)}" /></label>
            <label>权限名称<input name="permissionName" required value="${escapeHtml(value?.permissionName)}" /></label>
            <label>资源类型<input name="resourceType" value="${escapeHtml(value?.resourceType)}" placeholder="例如 API" /></label>
            ${this.statusSelect(value?.status ?? 1)}
            <label class="span-2">说明<textarea name="description">${escapeHtml(value?.description)}</textarea></label>`));
        this.bindDialogSubmit(dialog, async (data) => {
            const input: PermissionInput = { permissionCode: formValue(data, 'permissionCode'), permissionName: formValue(data, 'permissionName'), resourceType: formValue(data, 'resourceType'), description: formValue(data, 'description'), status: Number(formValue(data, 'status')) };
            if (id) await managementApi.updatePermission(id, input); else await managementApi.createPermission(input);
        });
    }

    private async openAdminRoles(id: number): Promise<void> {
        try {
            await this.openIdsDialog('分配管理员角色', await managementApi.roles(), (item) => item.roleName, (item) => item.roleCode, await managementApi.adminRoleIds(id), (ids) => managementApi.replaceAdminRoles(id, ids));
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    private async openRolePermissions(id: number): Promise<void> {
        try {
            await this.openIdsDialog('配置角色权限', await managementApi.permissions(), (item) => item.permissionName, (item) => item.permissionCode, await managementApi.rolePermissionIds(id), (ids) => managementApi.replaceRolePermissions(id, ids));
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    private async openIdsDialog<T extends { id: number }>(title: string, options: T[], label: (item: T) => string, code: (item: T) => string, selected: { ids: number[] }, save: (ids: number[]) => Promise<unknown>): Promise<void> {
        const dialog = openDialog(this, this.dialogShell(title, `<div class="choice-list span-2">${options.map((item) => `<label><input type="checkbox" name="ids" value="${item.id}" ${selected.ids.includes(item.id) ? 'checked' : ''}/><span><strong>${escapeHtml(label(item))}</strong><small>${escapeHtml(code(item))}</small></span></label>`).join('') || '<p>暂无可选项</p>'}</div>`));
        this.bindDialogSubmit(dialog, async (data) => save(data.getAll('ids').map(Number)));
    }

    private openPassword(id: number): void {
        const dialog = openDialog(this, this.dialogShell('重置管理员密码', '<label class="span-2">新密码<input name="password" type="password" required minlength="8" autocomplete="new-password" /></label>'));
        this.bindDialogSubmit(dialog, async (data) => managementApi.resetAdminPassword(id, formValue(data, 'password')));
    }

    private dialogShell(title: string, fields: string): string {
        return `<form class="dialog-card"><header><div><h3>${title}</h3><p>提交后立即同步到管理服务</p></div><button type="button" class="dialog-close" data-close aria-label="关闭">×</button></header><div class="dialog-fields">${fields}</div><p class="dialog-error" data-dialog-error></p><footer><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button">保存</button></footer></form>`;
    }

    private statusSelect(status: number): string {
        return `<label>状态<select name="status"><option value="1" ${status === 1 ? 'selected' : ''}>启用</option><option value="0" ${status === 0 ? 'selected' : ''}>停用</option></select></label>`;
    }

    private bindDialogSubmit(dialog: HTMLDialogElement, submit: (data: FormData) => Promise<unknown>): void {
        dialog.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;
            const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            const error = form.querySelector<HTMLElement>('[data-dialog-error]');
            if (button) button.disabled = true;
            void submit(new FormData(form)).then(() => {
                dialog.remove();
                this.notice = '保存成功';
                return this.load();
            }).catch((reason) => {
                if (error) error.textContent = errorMessage(reason);
                if (button) button.disabled = false;
            });
        });
    }

    private async run(action: () => Promise<void>, message: string): Promise<void> {
        try {
            await action();
            this.notice = message;
            await this.load();
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }
}

customElements.define('access-management-page', AccessManagementPage);
