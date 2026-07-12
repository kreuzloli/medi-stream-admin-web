import type { AdminSession } from '../types';

export type IconName = 'home' | 'users' | 'hospital' | 'catalog' | 'video' | 'cloud' | 'admin' | 'role' | 'shield';

export interface NavigationItem {
    label: string;
    path: string;
    icon: IconName;
    permission?: string;
}

export interface NavigationGroup {
    label?: string;
    items: NavigationItem[];
}

const navigation: NavigationGroup[] = [
    { items: [{ label: '工作台', path: '/', icon: 'home' }] },
    {
        label: '用户与机构',
        items: [
            { label: '用户管理', path: '/users', icon: 'users', permission: 'USER_VIEW' },
            { label: '医院管理', path: '/hospitals', icon: 'hospital', permission: 'HOSPITAL_VIEW' },
        ],
    },
    {
        label: '内容管理',
        items: [{ label: '内容目录', path: '/catalog', icon: 'catalog', permission: 'CATALOG_VIEW' }],
    },
    {
        label: '直播运营',
        items: [
            { label: '直播间管理', path: '/live/rooms', icon: 'video', permission: 'LIVE_VIEW' },
            { label: '腾讯云直播', path: '/live/tencent', icon: 'cloud', permission: 'TENCENT_LIVE_VIEW' },
        ],
    },
    {
        label: '权限管理',
        items: [
            { label: '管理员', path: '/access/admins', icon: 'admin', permission: 'ADMIN_VIEW' },
            { label: '角色', path: '/access/roles', icon: 'role', permission: 'ROLE_VIEW' },
            { label: '权限', path: '/access/permissions', icon: 'shield', permission: 'PERMISSION_VIEW' },
        ],
    },
];

/**
 * 根据 `/auth/me` 返回的角色和查看权限生成菜单。
 * 这里只控制前端可见性，最终访问权限仍由 Rust 后端校验。
 */
export function visibleNavigation(admin: Pick<AdminSession, 'roles' | 'permissions'>): NavigationGroup[] {
    const canViewAll = admin.roles.includes('SUPER_ADMIN');
    return navigation
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.permission || canViewAll || admin.permissions.includes(item.permission)),
        }))
        .filter((group) => group.items.length > 0);
}
