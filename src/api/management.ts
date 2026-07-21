import { sessionStore } from '../auth/session';
import { logger } from '../common/logger';
import { navigate } from '../router/routes';
import type {
    Administrator,
    FileObject,
    IdsResponse,
    PageResponse,
    Permission,
    Role,
    UserInfo,
} from '../types';
import { ApiError, requestJson } from './http';

type QueryValue = string | number | undefined;

/** 把管理列表筛选条件编码为查询串，并忽略空值。 */
function queryString(values: Record<string, QueryValue>): string {
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const result = query.toString();
    return result ? `?${result}` : '';
}

/**
 * 使用当前会话调用管理 API；失败日志只包含方法、路径和状态，不记录 Token 或请求体。
 * 401 会清理本地会话并返回登录页，避免页面继续展示失效的权限快照。
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
        return await requestJson(path, { ...options, token: sessionStore.accessToken });
    } catch (error) {
        logger.warn('management api request failed', {
            method: options.method ?? 'GET',
            path,
            status: error instanceof ApiError ? error.status : undefined,
        });
        if (error instanceof ApiError && error.status === 401) {
            sessionStore.clear();
            navigate('/login');
        }
        throw error;
    }
}

export interface AdminInput {
    username: string;
    realName: string;
    password?: string;
    status: number;
}

export interface RoleInput {
    roleCode: string;
    roleName: string;
    description?: string;
    status: number;
}

export interface PermissionInput {
    permissionCode: string;
    permissionName: string;
    resourceType?: string;
    description?: string;
    status: number;
}

export const managementApi = {
    /** 按页码、用户名和状态查询管理员，供筛选条件回显和分页使用。 */
    admins(values: Record<string, QueryValue>): Promise<PageResponse<Administrator>> {
        return request(`/admins${queryString(values)}`);
    },
    /** 创建管理员；初始密码只进入请求体，不进入 Web 日志。 */
    createAdmin(input: AdminInput): Promise<Administrator> {
        return request('/admins', { method: 'POST', body: JSON.stringify(input) });
    },
    /** 更新管理员基础信息，不隐式修改密码或角色关系。 */
    updateAdmin(id: number, input: AdminInput): Promise<Administrator> {
        return request(`/admins/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    /** 删除管理员，并由服务端同步清理目标账号会话。 */
    deleteAdmin(id: number): Promise<{ ok: boolean }> {
        return request(`/admins/${id}`, { method: 'DELETE' });
    },
    /** 修改管理员状态；停用后由服务端立即清理目标账号会话。 */
    setAdminStatus(id: number, status: number): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    /** 重置管理员密码；密码不写入 Web 日志，成功后目标账号会话失效。 */
    resetAdminPassword(id: number, password: string): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
    },
    /** 读取管理员当前角色 ID，用于编辑弹窗准确回显勾选项。 */
    adminRoleIds(id: number): Promise<IdsResponse> {
        return request(`/admins/${id}/roles`);
    },
    /** 全量替换管理员角色，而不是在现有关系上增量追加。 */
    replaceAdminRoles(id: number, ids: number[]): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/roles`, { method: 'PUT', body: JSON.stringify({ ids }) });
    },
    /** 获取包含停用项的角色定义，供维护列表和分配候选项共用。 */
    roles(): Promise<Role[]> {
        return request('/roles');
    },
    /** 创建尚未关联管理员的角色，不影响当前登录会话。 */
    createRole(input: RoleInput): Promise<{ id: number }> {
        return request('/roles', { method: 'POST', body: JSON.stringify(input) });
    },
    /** 更新角色基础信息；服务端只失效已绑定该角色的管理员会话。 */
    updateRole(id: number, input: RoleInput): Promise<{ id: number }> {
        return request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    /** 删除角色及其关联授权；服务端定向失效受影响管理员会话。 */
    deleteRole(id: number): Promise<{ deleted: boolean }> {
        return request(`/roles/${id}`, { method: 'DELETE' });
    },
    /** 修改角色状态，并使已绑定管理员重新获取权限快照。 */
    setRoleStatus(id: number, status: number): Promise<{ updated: boolean }> {
        return request(`/roles/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    /** 读取角色当前权限 ID，用于配置弹窗准确回显勾选项。 */
    rolePermissionIds(id: number): Promise<IdsResponse> {
        return request(`/roles/${id}/permissions`);
    },
    /** 全量替换角色权限，并由服务端定向失效绑定该角色的管理员。 */
    replaceRolePermissions(id: number, ids: number[]): Promise<{ ok: boolean }> {
        return request(`/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ ids }) });
    },
    /** 获取包含停用项的权限定义，供维护列表和授权候选项共用。 */
    permissions(): Promise<Permission[]> {
        return request('/permissions');
    },
    /** 创建尚未关联角色的权限定义，不影响当前登录会话。 */
    createPermission(input: PermissionInput): Promise<{ id: number }> {
        return request('/permissions', { method: 'POST', body: JSON.stringify(input) });
    },
    /** 更新权限定义；服务端只失效实际使用该权限的管理员会话。 */
    updatePermission(id: number, input: PermissionInput): Promise<{ id: number }> {
        return request(`/permissions/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    /** 删除权限及角色关联，并定向失效实际使用该权限的管理员。 */
    deletePermission(id: number): Promise<{ deleted: boolean }> {
        return request(`/permissions/${id}`, { method: 'DELETE' });
    },
    /** 修改权限状态，并使实际使用该权限的管理员重新获取权限快照。 */
    setPermissionStatus(id: number, status: number): Promise<{ updated: boolean }> {
        return request(`/permissions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    /** 按账号、姓名、身份和状态分页查询普通用户。 */
    users(values: Record<string, QueryValue>): Promise<PageResponse<UserInfo>> {
        return request(`/users${queryString(values)}`);
    },
    /** 查询用户详情，响应包含可直接展示的医院和科室名称。 */
    user(id: number): Promise<UserInfo> {
        return request(`/users/${id}`);
    },
    /** 读取用户头像或证件文件元数据，文件内容通过响应中的 fileUrl 展示。 */
    file(id: number): Promise<FileObject> {
        return request(`/files/${id}`);
    },
    /** 封禁或解封用户，不修改其业务资料和机构归属。 */
    setUserStatus(id: number, status: number): Promise<{ ok: boolean }> {
        return request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
};
