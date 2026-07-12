import { visibleNavigation } from '../navigation/navigation';
import { navigate } from '../router/routes';
import type { AdminSession } from '../types';
import { icon, streamMark } from '../ui/icons';

/** 根据管理员权限渲染分组导航，并负责导航折叠事件。 */
export class AdminSidebar extends HTMLElement {
    admin: AdminSession | null = null;
    activePath = '/';
    collapsed = false;

    connectedCallback(): void {
        this.render();
    }

    /** 使用最新管理员、路由和折叠状态刷新导航。 */
    update(admin: AdminSession, activePath: string, collapsed: boolean): void {
        this.admin = admin;
        this.activePath = activePath;
        this.collapsed = collapsed;
        this.render();
    }

    /** 输出经过权限过滤的菜单，并绑定无刷新导航事件。 */
    private render(): void {
        if (!this.admin) return;
        const groups = visibleNavigation(this.admin);
        this.toggleAttribute('collapsed', this.collapsed);
        this.innerHTML = `
            <div class="sidebar-brand">${streamMark()}<span>致辉科技 <b>管理后台</b></span></div>
            <nav aria-label="管理后台主导航">
                ${groups.map((group) => `
                    <section class="nav-group">
                        ${group.label ? `<h2>${group.label}</h2>` : ''}
                        ${group.items.map((item) => `
                            <a href="${item.path}" class="nav-item ${item.path === this.activePath ? 'active' : ''}" data-path="${item.path}" title="${item.label}">
                                ${icon(item.icon)}<span>${item.label}</span>
                            </a>`).join('')}
                    </section>`).join('')}
            </nav>
            <button class="sidebar-collapse" type="button" data-collapse aria-label="${this.collapsed ? '展开侧边栏' : '收起侧边栏'}">‹‹<span>收起导航</span></button>`;
        this.querySelectorAll<HTMLAnchorElement>('[data-path]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                navigate(link.dataset.path ?? '/');
                this.dispatchEvent(new CustomEvent('navigate', { bubbles: true }));
            });
        });
        this.querySelector('[data-collapse]')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('toggle-sidebar', { bubbles: true }));
        });
    }
}

customElements.define('admin-sidebar', AdminSidebar);
