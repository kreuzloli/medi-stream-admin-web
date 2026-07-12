import type { AppRoute } from '../router/routes';
import { navigate } from '../router/routes';
import { icon } from '../ui/icons';

/** 尚未接入 CRUD 功能时使用的统一模块占位页。 */
export class PlaceholderPage extends HTMLElement {
    /** 根据路由元数据展示模块名称和建设状态。 */
    update(route: AppRoute): void {
        this.innerHTML = `
            <section class="placeholder-page">
                <div class="placeholder-icon">${icon('catalog')}</div>
                <h2>${route.title}</h2>
                <p>${route.description ?? '该模块正在建设中。'}</p>
                <span>页面框架已就绪，业务功能将在后续迭代中接入。</span>
                <button type="button">返回工作台</button>
            </section>`;
        this.querySelector('button')?.addEventListener('click', () => navigate('/'));
    }
}

customElements.define('placeholder-page', PlaceholderPage);
