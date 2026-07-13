import { ApiError } from '../api/http';

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? escapeHtml(value)
        : new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).format(date);
}

export function statusBadge(status: number): string {
    return status === 1
        ? '<span class="status-badge enabled"><i></i>启用</span>'
        : '<span class="status-badge disabled"><i></i>停用</span>';
}

export function errorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : '操作失败，请稍后重试';
}

export function formValue(form: FormData, name: string): string {
    return String(form.get(name) ?? '').trim();
}

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

export function loadingRows(columns: number): string {
    return `<tr><td colspan="${columns}" class="table-state"><span class="brand-loader small"></span>正在加载数据</td></tr>`;
}

export function emptyRows(columns: number, message = '暂无数据'): string {
    return `<tr><td colspan="${columns}" class="table-state muted">${escapeHtml(message)}</td></tr>`;
}
