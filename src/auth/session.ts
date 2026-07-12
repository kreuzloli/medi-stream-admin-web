import { loadCurrentAdmin, login, logout } from '../api/auth';
import { ApiError } from '../api/http';
import { logger } from '../common/logger';
import type { AdminSession } from '../types';

const TOKEN_KEY = 'medi-stream-admin-token';

export class SessionStore extends EventTarget {
    private token: string | null = localStorage.getItem(TOKEN_KEY);
    private admin: AdminSession | null = null;

    get currentAdmin(): AdminSession | null {
        return this.admin;
    }

    get authenticated(): boolean {
        return Boolean(this.token && this.admin);
    }

    /** 使用账号密码建立完整会话，只有 `/auth/me` 成功后才通知页面登录完成。 */
    async signIn(username: string, password: string): Promise<void> {
        let result;
        try {
            result = await login(username, password);
        } catch (error) {
            logger.warn('administrator login failed', {
                username,
                status: error instanceof ApiError ? error.status : undefined,
            });
            throw error;
        }
        localStorage.setItem(TOKEN_KEY, result.token);
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
            username: this.admin.username,
        });
        this.notify();
    }

    /** 页面刷新时使用本地 Token 恢复会话；401 表示 Token 已失效。 */
    async restore(): Promise<boolean> {
        if (!this.token) {
            return false;
        }
        try {
            this.admin = await loadCurrentAdmin(this.token);
            logger.info('administrator session restored', {
                adminId: this.admin.adminId,
                username: this.admin.username,
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
        localStorage.removeItem(TOKEN_KEY);
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
