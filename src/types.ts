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
