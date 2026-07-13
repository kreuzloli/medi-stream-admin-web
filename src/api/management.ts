import { sessionStore } from '../auth/session';
import { navigate } from '../router/routes';
import type {
    Administrator,
    IdsResponse,
    PageResponse,
    Permission,
    Role,
    UserInfo,
} from '../types';
import { ApiError, requestJson } from './http';

type QueryValue = string | number | undefined;

function queryString(values: Record<string, QueryValue>): string {
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const result = query.toString();
    return result ? `?${result}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
        return await requestJson(path, { ...options, token: sessionStore.accessToken });
    } catch (error) {
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
    admins(values: Record<string, QueryValue>): Promise<PageResponse<Administrator>> {
        return request(`/admins${queryString(values)}`);
    },
    createAdmin(input: AdminInput): Promise<Administrator> {
        return request('/admins', { method: 'POST', body: JSON.stringify(input) });
    },
    updateAdmin(id: number, input: AdminInput): Promise<Administrator> {
        return request(`/admins/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    deleteAdmin(id: number): Promise<{ ok: boolean }> {
        return request(`/admins/${id}`, { method: 'DELETE' });
    },
    setAdminStatus(id: number, status: number): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    resetAdminPassword(id: number, password: string): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
    },
    adminRoleIds(id: number): Promise<IdsResponse> {
        return request(`/admins/${id}/roles`);
    },
    replaceAdminRoles(id: number, ids: number[]): Promise<{ ok: boolean }> {
        return request(`/admins/${id}/roles`, { method: 'PUT', body: JSON.stringify({ ids }) });
    },
    roles(): Promise<Role[]> {
        return request('/roles');
    },
    createRole(input: RoleInput): Promise<{ id: number }> {
        return request('/roles', { method: 'POST', body: JSON.stringify(input) });
    },
    updateRole(id: number, input: RoleInput): Promise<{ id: number }> {
        return request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    deleteRole(id: number): Promise<{ deleted: boolean }> {
        return request(`/roles/${id}`, { method: 'DELETE' });
    },
    setRoleStatus(id: number, status: number): Promise<{ updated: boolean }> {
        return request(`/roles/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    rolePermissionIds(id: number): Promise<IdsResponse> {
        return request(`/roles/${id}/permissions`);
    },
    replaceRolePermissions(id: number, ids: number[]): Promise<{ ok: boolean }> {
        return request(`/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ ids }) });
    },
    permissions(): Promise<Permission[]> {
        return request('/permissions');
    },
    createPermission(input: PermissionInput): Promise<{ id: number }> {
        return request('/permissions', { method: 'POST', body: JSON.stringify(input) });
    },
    updatePermission(id: number, input: PermissionInput): Promise<{ id: number }> {
        return request(`/permissions/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    deletePermission(id: number): Promise<{ deleted: boolean }> {
        return request(`/permissions/${id}`, { method: 'DELETE' });
    },
    setPermissionStatus(id: number, status: number): Promise<{ updated: boolean }> {
        return request(`/permissions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
    users(values: Record<string, QueryValue>): Promise<PageResponse<UserInfo>> {
        return request(`/users${queryString(values)}`);
    },
    user(id: number): Promise<UserInfo> {
        return request(`/users/${id}`);
    },
    setUserStatus(id: number, status: number): Promise<{ ok: boolean }> {
        return request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    },
};
