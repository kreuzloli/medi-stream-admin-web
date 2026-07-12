import { navigate } from '../router/routes';
import type { AdminSession } from '../types';
import { icon } from '../ui/icons';

const shortcuts = [
    { title: '用户与机构', text: '管理平台用户与医院机构信息', path: '/users', icon: 'users' as const },
    { title: '内容管理', text: '管理医疗内容目录与资料', path: '/catalog', icon: 'catalog' as const },
    { title: '直播运营', text: '管理直播间与腾讯云直播配置', path: '/live/rooms', icon: 'video' as const },
    { title: '权限管理', text: '管理管理员、角色与权限配置', path: '/access/admins', icon: 'shield' as const },
];

/** 登录后的工作台欢迎页，提供已规划模块的快捷入口。 */
export class WelcomePage extends HTMLElement {
    /** 根据当前时间和管理员账号渲染问候及模块入口。 */
    update(admin: AdminSession): void {
        const hour = new Date().getHours();
        const greeting = hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
        const date = new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
        }).format(new Date());
        this.innerHTML = `
            <section class="welcome-page">
                <div class="welcome-hero">
                    <div>
                        <h2>${greeting}，<strong>${admin.username}</strong></h2>
                        <p>欢迎使用 致辉科技管理后台</p>
                        <span class="welcome-date">${icon('calendar')}${date}</span>
                    </div>
                    <div class="hero-mark" aria-hidden="true"><i></i><i></i><i></i></div>
                </div>
                <div class="module-section">
                    <div class="section-heading">
                        <div><h2>常用模块</h2><p>选择模块开始管理平台业务</p></div>
                        <span>${icon('check')} 系统服务已连接</span>
                    </div>
                    <div class="module-list">
                        ${shortcuts.map((item) => `
                            <button type="button" class="module-row" data-path="${item.path}">
                                <span class="module-icon ${item.icon}">${icon(item.icon)}</span>
                                <span class="module-copy"><strong>${item.title}</strong><small>${item.text}</small></span>
                                <span class="module-state">进入模块</span>${icon('arrow')}
                            </button>`).join('')}
                    </div>
                </div>
            </section>`;
        this.querySelectorAll<HTMLButtonElement>('[data-path]').forEach((button) => {
            button.addEventListener('click', () => navigate(button.dataset.path ?? '/'));
        });
    }
}

customElements.define('welcome-page', WelcomePage);
