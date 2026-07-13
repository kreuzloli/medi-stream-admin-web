import { ApiError } from '../api/http';

/** 转义动态文本，防止管理数据被解释为 HTML。 */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/** 把后端时间转换为中文日期；无效值安全回显原文。 */
export function formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? escapeHtml(value)
        : new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).format(date);
}

/** 使用统一样式渲染二元启停状态。 */
export function statusBadge(status: number): string {
    return status === 1
        ? '<span class="status-badge enabled"><i></i>启用</span>'
        : '<span class="status-badge disabled"><i></i>停用</span>';
}

/** 提取可展示的 API 错误，隐藏未知异常的内部细节。 */
export function errorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : '操作失败，请稍后重试';
}

/** 读取并清理表单字符串值，避免各编辑器重复处理空白。 */
export function formValue(form: FormData, name: string): string {
    return String(form.get(name) ?? '').trim();
}

/** 在组件内保持单一弹窗，并绑定按钮和遮罩关闭行为。 */
export function openDialog(host: HTMLElement, body: string): HTMLDialogElement {
    host.querySelector('dialog')?.remove();
    host.insertAdjacentHTML('beforeend', `<dialog class="management-dialog" open>${body}</dialog>`);
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    dialog.querySelectorAll<HTMLElement>('[data-close]').forEach((button) => {
        button.addEventListener('click', () => dialog.remove());
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.remove();
    });
    return dialog;
}

/** 生成覆盖整行的表格加载状态。 */
export function loadingRows(columns: number): string {
    return `<tr><td colspan="${columns}" class="table-state"><span class="brand-loader small"></span>正在加载数据</td></tr>`;
}

/** 生成覆盖整行的空数据提示，并转义自定义文案。 */
export function emptyRows(columns: number, message = '暂无数据'): string {
    return `<tr><td colspan="${columns}" class="table-state muted">${escapeHtml(message)}</td></tr>`;
}
