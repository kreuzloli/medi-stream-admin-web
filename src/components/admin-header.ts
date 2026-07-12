import type { AdminSession } from '../types';
import { icon } from '../ui/icons';

/** 后台顶栏，展示当前页面、管理员身份和全局操作。 */
export class AdminHeader extends HTMLElement {
    /** 使用当前会话和路由标题刷新顶栏。 */
    update(admin: AdminSession, title: string): void {
        this.innerHTML = `
            <header class="admin-header">
                <div class="header-title">
                    <button type="button" class="icon-button" data-menu aria-label="打开或关闭导航">${icon('menu')}</button>
                    <h1>${title}</h1>
                </div>
                <div class="header-account">
                    <span class="account-avatar">${admin.username.slice(0, 1).toUpperCase()}</span>
                    <span class="account-name">${admin.username}</span>
                    <span class="header-divider"></span>
                    <button type="button" class="logout-button" data-logout>${icon('logout')}<span>退出登录</span></button>
                </div>
            </header>`;
        this.querySelector('[data-menu]')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('toggle-sidebar', { bubbles: true }));
        });
        this.querySelector('[data-logout]')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('logout', { bubbles: true }));
        });
    }
}

customElements.define('admin-header', AdminHeader);
