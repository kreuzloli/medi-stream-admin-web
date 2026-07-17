import { ApiError } from './api/http';
import { sessionStore } from './auth/session';
import { logger } from './common/logger';
import './components/admin-header';
import './components/admin-sidebar';
import './pages/login-page';
import './pages/access-management-page';
import './pages/live-management-page';
import './pages/live-play-page';
import './pages/live-push-page';
import './pages/live-watch-page';
import './pages/placeholder-page';
import './pages/tencent-live-page';
import './pages/user-management-page';
import './pages/welcome-page';
import { matchRoute, navigate, routePathFromHash, routeRoomIdFromHash } from './router/routes';
import type { AppRoute } from './router/routes';
import type { AdminHeader } from './components/admin-header';
import type { AdminSidebar } from './components/admin-sidebar';
import type { PlaceholderPage } from './pages/placeholder-page';
import type { WelcomePage } from './pages/welcome-page';
import type { AccessManagementPage, AccessPageKind } from './pages/access-management-page';
import type { AdminSession } from './types';

/** 对直接 Hash 访问执行与导航菜单一致的直播权限校验。 */
export function canAccessRoute(
    kind: AppRoute['kind'],
    admin: Pick<AdminSession, 'roles' | 'permissions'>,
): boolean {
    if (admin.roles.includes('SUPER_ADMIN')) return true;
    if (['liveRooms', 'liveWatch', 'livePlay'].includes(kind)) {
        return admin.permissions.includes('LIVE_VIEW');
    }
    if (kind === 'livePush') {
        return admin.permissions.includes('TENCENT_LIVE_MANAGE');
    }
    return true;
}

/** 把路由类型映射到具体页面标签，避免根组件内形成难读的条件表达式。 */
export function pageTagForRouteKind(kind: AppRoute['kind']): string {
    switch (kind) {
        case 'welcome': return '<welcome-page></welcome-page>';
        case 'users': return '<user-management-page></user-management-page>';
        case 'liveRooms': return '<live-management-page></live-management-page>';
        case 'liveWatch': return '<live-watch-page></live-watch-page>';
        case 'livePush': return '<live-push-page></live-push-page>';
        case 'livePlay': return '<live-play-page></live-play-page>';
        case 'tencentLive': return '<tencent-live-page></tencent-live-page>';
        case 'admins':
        case 'roles':
        case 'permissions': return '<access-management-page></access-management-page>';
        default: return '<placeholder-page></placeholder-page>';
    }
}

/**
 * 管理端根组件，负责会话恢复、访问保护、应用框架和页面切换。
 * 具体业务页面只负责自身展示，避免重复处理全局登录态。
 */
export class AdminApp extends HTMLElement {
    private sidebarCollapsed = false;
    private mobileSidebarOpen = false;
    private loading = true;

    /** 注册全局路由、会话和组件事件，然后尝试恢复登录态。 */
    connectedCallback(): void {
        window.addEventListener('hashchange', this.render);
        sessionStore.addEventListener('change', this.render);
        this.addEventListener('toggle-sidebar', this.toggleSidebar);
        this.addEventListener('navigate', this.closeMobileSidebar);
        this.addEventListener('logout', this.handleLogout);
        this.render();
        void this.restoreSession();
    }

    /** 组件卸载时释放全局事件，避免热更新后重复响应。 */
    disconnectedCallback(): void {
        window.removeEventListener('hashchange', this.render);
        sessionStore.removeEventListener('change', this.render);
        this.removeEventListener('toggle-sidebar', this.toggleSidebar);
        this.removeEventListener('navigate', this.closeMobileSidebar);
        this.removeEventListener('logout', this.handleLogout);
    }

    /** 在首屏渲染前校验本地 Token，失败时展示可重试的服务错误。 */
    private readonly restoreSession = async (): Promise<void> => {
        try {
            await sessionStore.restore();
        } catch (error) {
            logger.error('session restore blocked application startup', {
                status: error instanceof ApiError ? error.status : undefined,
                errorType: error instanceof Error ? error.name : 'unknown',
            });
            this.showFatalError(error instanceof ApiError ? error.message : '暂时无法连接管理服务');
            return;
        }
        this.loading = false;
        this.render();
    };

    /** 根据加载状态、会话和当前路由组合登录页或后台框架。 */
    private readonly render = (): void => {
        if (this.loading) {
            this.innerHTML = '<main class="app-loading"><span class="brand-loader"></span><p>正在加载管理后台</p></main>';
            return;
        }

        const admin = sessionStore.currentAdmin;
        const currentPath = routePathFromHash(window.location.hash);
        if (!admin) {
            if (currentPath !== '/login') {
                window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
            }
            this.innerHTML = '<login-page></login-page>';
            return;
        }

        if (currentPath === '/login') {
            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/`);
        }
        const route = matchRoute(currentPath === '/login' ? '/' : currentPath);
        const canAccess = canAccessRoute(route.kind, admin);
        const content = canAccess
            ? pageTagForRouteKind(route.kind)
            : '<section class="placeholder-page access-denied"><div class="placeholder-icon">!</div><h2>无权访问</h2><p>当前管理员没有访问此直播功能的权限。</p></section>';
        this.innerHTML = `
            <div class="admin-layout ${this.sidebarCollapsed ? 'is-collapsed' : ''} ${this.mobileSidebarOpen ? 'mobile-open' : ''}">
                <admin-sidebar></admin-sidebar>
                <button class="sidebar-backdrop" type="button" aria-label="关闭导航"></button>
                <div class="admin-main">
                    <admin-header></admin-header>
                    <main class="admin-content">${content}</main>
                </div>
            </div>`;
        this.querySelector<AdminSidebar>('admin-sidebar')?.update(admin, route.path, this.sidebarCollapsed);
        this.querySelector<AdminHeader>('admin-header')?.update(admin, route.title);
        this.querySelector<WelcomePage>('welcome-page')?.update(admin);
        this.querySelector<PlaceholderPage>('placeholder-page')?.update(route);
        const accessPage = this.querySelector<AccessManagementPage>('access-management-page');
        if (accessPage) void accessPage.update(route.kind as AccessPageKind);
        const livePage = this.querySelector<import('./pages/live-management-page').LiveManagementPage>('live-management-page');
        if (livePage) void livePage.update();
        const watchPage = this.querySelector<import('./pages/live-watch-page').LiveWatchPage>('live-watch-page');
        if (watchPage) void watchPage.update();
        const roomId = routeRoomIdFromHash(window.location.hash);
        const pushPage = this.querySelector<import('./pages/live-push-page').LivePushPage>('live-push-page');
        if (pushPage && roomId) void pushPage.update(roomId);
        const playPage = this.querySelector<import('./pages/live-play-page').LivePlayPage>('live-play-page');
        if (playPage && roomId) void playPage.update(roomId);
        this.querySelector('.sidebar-backdrop')?.addEventListener('click', this.closeMobileSidebar);
    };

    /** 桌面端折叠导航，窄屏下切换抽屉显示状态。 */
    private readonly toggleSidebar = (): void => {
        if (window.matchMedia('(max-width: 800px)').matches) {
            this.mobileSidebarOpen = !this.mobileSidebarOpen;
        } else {
            this.sidebarCollapsed = !this.sidebarCollapsed;
        }
        this.render();
    };

    /** 页面导航完成后关闭移动端抽屉，桌面端状态保持不变。 */
    private readonly closeMobileSidebar = (): void => {
        if (this.mobileSidebarOpen) {
            this.mobileSidebarOpen = false;
            this.render();
        }
    };

    /** 完成服务端注销后回到登录页。 */
    private readonly handleLogout = async (): Promise<void> => {
        await sessionStore.signOut();
        navigate('/login');
    };

    /** 展示阻断启动的错误，并提供显式重试入口。 */
    private showFatalError(message: string): void {
        this.loading = false;
        this.innerHTML = `<main class="fatal-error"><h1>管理服务暂不可用</h1><p>${message}</p><button type="button">重新加载</button></main>`;
        this.querySelector('button')?.addEventListener('click', () => window.location.reload());
    }
}

customElements.define('admin-app', AdminApp);
