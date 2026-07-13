import { logger } from '../common/logger';

/** 描述后台内容区支持的轻量前端路由。 */
export interface AppRoute {
    path: string;
    title: string;
    kind: 'welcome' | 'placeholder' | 'users' | 'admins' | 'roles' | 'permissions';
    description?: string;
}

const routes: AppRoute[] = [
    { path: '/', title: '工作台', kind: 'welcome' },
    { path: '/users', title: '用户管理', kind: 'users', description: '管理平台注册用户及账号状态。' },
    { path: '/hospitals', title: '医院管理', kind: 'placeholder', description: '维护医院机构与关联信息。' },
    { path: '/catalog', title: '内容目录', kind: 'placeholder', description: '维护医疗内容目录与资料。' },
    { path: '/live/rooms', title: '直播间管理', kind: 'placeholder', description: '管理直播间、归属关系与直播状态。' },
    { path: '/live/tencent', title: '腾讯云直播', kind: 'placeholder', description: '管理推流、播放与腾讯云直播配置。' },
    { path: '/access/admins', title: '管理员', kind: 'admins', description: '维护后台管理员账号和状态。' },
    { path: '/access/roles', title: '角色', kind: 'roles', description: '配置管理端角色与权限范围。' },
    { path: '/access/permissions', title: '权限', kind: 'permissions', description: '维护权限代码和资源定义。' },
];

/** 返回与地址精确匹配的页面；未知地址安全回退到工作台。 */
export function matchRoute(pathname: string): AppRoute {
    return routes.find((route) => route.path === pathname) ?? routes[0];
}

/**
 * 从 Hash 中提取当前页面路径。
 * Hash 不会发送给服务器，因此 `/admin/#/...` 刷新时不需要 Nginx配置子路由 fallback。
 */
export function routePathFromHash(hash: string): string {
    const path = hash.replace(/^#/, '').split('?')[0].trim();
    if (!path) {
        return '/';
    }
    return path.startsWith('/') ? path : `/${path}`;
}

/** 更新 Hash 地址并通知根组件重新渲染，不触发整页刷新。 */
export function navigate(path: string): void {
    const nextHash = `#${path}`;
    if (window.location.hash !== nextHash) {
        window.location.hash = path;
    } else {
        // 相同 Hash 不会触发浏览器事件，手动通知以保持调用语义一致。
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    logger.info('route changed', { path });
}
