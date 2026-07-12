import type { AdminSession, LoginResponse } from '../types';
import { requestJson } from './http';

/** 使用管理员账号密码换取 JWT。 */
export function login(username: string, password: string): Promise<LoginResponse> {
    return requestJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/** 使用现有 JWT 加载当前管理员的角色和权限。 */
export function loadCurrentAdmin(token: string): Promise<AdminSession> {
    return requestJson('/auth/me', { token });
}

/** 通知后端注销当前 JWT，使 Redis 中的登录态立即失效。 */
export function logout(token: string): Promise<{ ok: boolean }> {
    return requestJson('/auth/logout', { method: 'POST', token });
}
