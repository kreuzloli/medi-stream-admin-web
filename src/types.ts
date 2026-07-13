/** `/auth/me` 返回的当前管理员会话信息。 */
export interface AdminSession {
    adminId: number;
    username: string;
    roles: string[];
    permissions: string[];
}

/** `/auth/login` 返回的短期访问凭证。 */
export interface LoginResponse {
    token: string;
}

export interface PageResponse<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface Administrator {
    id: number;
    username: string;
    realName: string;
    lastLoginAt?: string | null;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface Role {
    id: number;
    roleCode: string;
    roleName: string;
    description?: string | null;
    status: number;
}

export interface Permission {
    id: number;
    permissionCode: string;
    permissionName: string;
    resourceType?: string | null;
    description?: string | null;
    status: number;
}

export interface UserInfo {
    id: number;
    userCode?: string | null;
    realName: string;
    nickname?: string | null;
    hospitalId?: number | null;
    deptId?: number | null;
    hospitalName?: string | null;
    deptName?: string | null;
    identityType?: string | null;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface IdsResponse {
    ids: number[];
}
