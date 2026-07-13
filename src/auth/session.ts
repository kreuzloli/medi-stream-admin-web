import { loadCurrentAdmin, login, logout } from '../api/auth';
import { ApiError } from '../api/http';
import { logger } from '../common/logger';
import type { AdminSession } from '../types';

const TOKEN_KEY = 'medi-stream-admin-token';

/** 安全访问浏览器存储；隐私模式或测试环境禁用存储时返回空。 */
function browserStorage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage ?? null;
    } catch {
        return null;
    }
}

export class SessionStore extends EventTarget {
    private token: string | null = null;
    private admin: AdminSession | null = null;

    /** 返回当前已加载的管理员信息；会话未恢复时为空。 */
    get currentAdmin(): AdminSession | null {
        return this.admin;
    }

    /** 只有 Token 和管理员信息同时存在时才视为完整登录。 */
    get authenticated(): boolean {
        return Boolean(this.token && this.admin);
    }

    /** 返回业务 API 使用的当前 Token；未登录时拒绝发出受保护请求。 */
    get accessToken(): string {
        if (!this.token) {
            throw new ApiError(401, '登录状态已失效');
        }
        return this.token;
    }

    /** 判断当前管理员是否拥有指定权限；超级管理员不受权限代码限制。 */
    can(permission: string): boolean {
        return Boolean(
            this.admin
            && (this.admin.roles.includes('SUPER_ADMIN') || this.admin.permissions.includes(permission)),
        );
    }

    /** 使用账号密码建立完整会话，只有 `/auth/me` 成功后才通知页面登录完成。 */
    async signIn(username: string, password: string): Promise<void> {
        let result;
        try {
            result = await login(username, password);
        } catch (error) {
            logger.warn('administrator login failed', {
                status: error instanceof ApiError ? error.status : undefined,
            });
            throw error;
        }
        browserStorage()?.setItem(TOKEN_KEY, result.token);
        this.token = result.token;
        try {
            this.admin = await loadCurrentAdmin(result.token);
        } catch (error) {
            // Token 已签发但管理员信息加载失败时必须回滚，避免留下半登录状态。
            this.clear();
            throw error;
        }
        logger.info('administrator login succeeded', {
            adminId: this.admin.adminId,
        });
        this.notify();
    }

    /** 页面刷新时使用本地 Token 恢复会话；401 表示 Token 已失效。 */
    async restore(): Promise<boolean> {
        this.token ??= browserStorage()?.getItem(TOKEN_KEY) ?? null;
        if (!this.token) {
            return false;
        }
        try {
            this.admin = await loadCurrentAdmin(this.token);
            logger.info('administrator session restored', {
                adminId: this.admin.adminId,
            });
            this.notify();
            return true;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                logger.warn('administrator session expired');
                this.clear();
                return false;
            }
            throw error;
        }
    }

    /** 尽力通知后端注销，并始终清理浏览器中的本地会话。 */
    async signOut(): Promise<void> {
        const token = this.token;
        try {
            if (token) {
                await logout(token);
            }
            logger.info('administrator logout succeeded', {
                adminId: this.admin?.adminId,
            });
        } catch (error) {
            logger.warn('administrator logout request failed', {
                adminId: this.admin?.adminId,
                status: error instanceof ApiError ? error.status : undefined,
            });
        } finally {
            // 即使服务端暂不可用，也不能让浏览器继续持有看似有效的登录态。
            this.clear();
        }
    }

    /** 清除所有会话信息；此方法不会打印 Token。 */
    clear(): void {
        browserStorage()?.removeItem(TOKEN_KEY);
        this.token = null;
        this.admin = null;
        this.notify();
    }

    /** 通知根组件重新计算受保护页面。 */
    private notify(): void {
        this.dispatchEvent(new Event('change'));
    }
}

export const sessionStore = new SessionStore();
