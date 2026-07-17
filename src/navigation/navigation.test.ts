import { describe, expect, it } from 'vitest';

import { visibleNavigation } from './navigation';

describe('visibleNavigation', () => {
    it('shows all administration groups to a super administrator', () => {
        const groups = visibleNavigation({ roles: ['SUPER_ADMIN'], permissions: [] });

        expect(groups.flatMap((group) => group.items).map((item) => item.label)).toEqual([
            '工作台',
            '用户管理',
            '医院管理',
            '内容目录',
            '直播间管理',
            '观看直播',
            '腾讯云直播',
            '管理员',
            '角色',
            '权限',
        ]);
    });

    it('only shows modules covered by view permissions', () => {
        const groups = visibleNavigation({ roles: [], permissions: ['USER_VIEW', 'LIVE_VIEW'] });

        expect(groups.flatMap((group) => group.items).map((item) => item.label)).toEqual([
            '工作台',
            '用户管理',
            '直播间管理',
            '观看直播',
        ]);
    });
});
