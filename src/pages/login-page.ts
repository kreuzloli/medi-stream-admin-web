import { ApiError } from '../api/http';
import { sessionStore } from '../auth/session';
import { navigate } from '../router/routes';
import { icon, streamMark } from '../ui/icons';

/** 管理员账号密码登录页，负责表单交互和错误反馈。 */
export class LoginPage extends HTMLElement {
    /** 渲染表单并绑定提交和密码可见性事件。 */
    connectedCallback(): void {
        this.render();
        this.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => void this.submit(event));
        this.querySelector<HTMLButtonElement>('[data-toggle-password]')?.addEventListener('click', () => this.togglePassword());
    }

    /** 校验输入、阻止重复提交，并在会话建立成功后进入工作台。 */
    private async submit(event: SubmitEvent): Promise<void> {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const username = String(data.get('username') ?? '').trim();
        const password = String(data.get('password') ?? '');
        const error = this.querySelector<HTMLElement>('[data-error]');
        const button = this.querySelector<HTMLButtonElement>('button[type="submit"]');

        if (!username || !password) {
            if (error) error.textContent = '请输入用户名和密码';
            return;
        }

        if (error) error.textContent = '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="button-spinner"></span> 正在登录';
        }

        try {
            await sessionStore.signIn(username, password);
            navigate('/');
        } catch (reason) {
            if (error) {
                error.textContent = reason instanceof ApiError
                    ? reason.message
                    : '登录失败，请稍后重试';
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = '登 录';
            }
        }
    }

    /** 在不修改密码值的情况下切换输入框显示状态。 */
    private togglePassword(): void {
        const input = this.querySelector<HTMLInputElement>('#password');
        const button = this.querySelector<HTMLButtonElement>('[data-toggle-password]');
        if (!input || !button) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        button.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
    }

    /** 输出登录页结构；所有可变反馈通过当前组件内的节点更新。 */
    private render(): void {
        this.innerHTML = `
            <main class="login-page">
                <section class="login-brand" aria-label="致辉科技 管理后台">
                    <div class="brand-content">
                        ${streamMark()}
                        <h1>致辉科技 <span>管理后台</span></h1>
                        <p>专业 · 稳定 · 安全的医疗直播管理平台</p>
                    </div>
                    <div class="brand-waves" aria-hidden="true"></div>
                    <footer>
                        <span>© ${new Date().getFullYear()} 北京致辉科技有限公司. 保留所有权利。</span>
                        <span>建议使用现代浏览器访问</span>
                    </footer>
                </section>
                <section class="login-panel">
                    <div class="login-card">
                        <div class="mobile-brand">${streamMark()}<span>致辉科技</span></div>
                        <h2>欢迎登录</h2>
                        <p class="login-subtitle">致辉科技管理后台</p>
                        <form novalidate>
                            <label for="username">用户名</label>
                            <div class="input-wrap">
                                ${icon('admin')}
                                <input id="username" name="username" autocomplete="username" placeholder="请输入用户名" autofocus />
                            </div>
                            <label for="password">密码</label>
                            <div class="input-wrap">
                                ${icon('lock')}
                                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
                                <button type="button" class="password-toggle" data-toggle-password aria-label="显示密码">${icon('eye')}</button>
                            </div>
                            <p class="form-error" data-error aria-live="polite"></p>
                            <button class="login-button" type="submit">登 录</button>
                        </form>
                        <p class="security-note">${icon('shield')}<span>请妥善保管您的账号和密码，不要与他人共享。</span></p>
                    </div>
                </section>
            </main>`;
    }
}

customElements.define('login-page', LoginPage);
