import { liveApi, type LiveRoomInput, type LiveRoomStreamInput } from '../api/live';
import { sessionStore } from '../auth/session';
import type { FileObject, LiveRoom, LiveRoomDetail } from '../types';
import {
    emptyRows,
    errorMessage,
    escapeHtml,
    formValue,
    formatDate,
    loadingRows,
    openDialog,
} from './management-shared';

/** 把可选数字字段转换为 API 使用的 undefined，避免把空输入提交为 0。 */
function optionalNumber(value: string): number | undefined {
    return value === '' ? undefined : Number(value);
}

/** datetime-local 省略秒时补齐秒，匹配 Rust NaiveDateTime 的输入格式。 */
function apiDateTime(value: string): string | undefined {
    if (!value) return undefined;
    return value.length === 16 ? `${value}:00` : value;
}

function inputDateTime(value?: string | null): string {
    return value ? value.replace(' ', 'T').slice(0, 16) : '';
}

function roomStatusBadge(status: number): string {
    if (status === 1) return '<span class="status-badge enabled"><i></i>启用</span>';
    if (status === 2) return '<span class="status-badge banned"><i></i>封禁</span>';
    return '<span class="status-badge disabled"><i></i>停用</span>';
}

/** 直播间运营页面，统一维护房间、封面、多路直播流和房主归属。 */
export class LiveManagementPage extends HTMLElement {
    private rooms: LiveRoom[] = [];
    private loading = false;
    private error = '';
    private notice = '';
    private filters = { roomCode: '', title: '', status: '', isTop: '' };
    private page = 1;
    private total = 0;

    async update(): Promise<void> {
        await this.load();
    }

    /** 按当前筛选和页码读取直播间列表。 */
    private async load(): Promise<void> {
        this.loading = true;
        this.error = '';
        this.render();
        try {
            const result = await liveApi.rooms({ page: this.page, size: 20, ...this.filters });
            this.rooms = result.records;
            this.total = result.total;
        } catch (error) {
            this.error = errorMessage(error);
        } finally {
            this.loading = false;
            this.render();
        }
    }

    /** 组合筛选区、列表和分页，并根据 LIVE_MANAGE 控制写操作。 */
    private render(): void {
        const canManage = sessionStore.can('LIVE_MANAGE');
        const rows = this.loading ? loadingRows(8) : this.rooms.length === 0 ? emptyRows(8, '暂无直播间')
            : this.rooms.map((room) => `<tr>
                <td><div class="primary-cell"><strong>${escapeHtml(room.title)}</strong><small>${escapeHtml(room.roomCode)}</small></div></td>
                <td>${room.ownerAdminId ? `管理员 #${room.ownerAdminId}` : `用户 #${room.ownerUserId ?? '—'}`}</td>
                <td>${room.departmentId ?? '—'} / ${room.diseaseId ?? '—'}</td>
                <td>${room.isTop === 1 ? '<span class="status-badge enabled"><i></i>已置顶</span>' : '普通'}</td>
                <td>${roomStatusBadge(room.status)}</td><td>${formatDate(room.startTime)}</td><td>${formatDate(room.updatedAt)}</td>
                <td class="row-actions">${canManage ? `
                    <button data-action="edit" data-id="${room.id}">编辑</button>
                    <button data-action="owner" data-id="${room.id}">房主</button>
                    <button data-action="top" data-id="${room.id}">${room.isTop === 1 ? '取消置顶' : '置顶'}</button>
                    <button data-action="status" data-id="${room.id}">${room.status === 1 ? '停用' : '启用'}</button>
                    <button class="danger" data-action="delete" data-id="${room.id}">删除</button>` : '—'}</td>
            </tr>`).join('');
        const pages = Math.max(1, Math.ceil(this.total / 20));
        this.innerHTML = `<section class="management-page live-management-page">
            <div class="management-titlebar"><div><h2>直播间管理</h2><p>维护直播间信息、封面和多路腾讯云直播流</p></div>${canManage ? '<button class="primary-button" data-create>＋ 新增直播间</button>' : ''}</div>
            ${this.notice ? `<div class="page-notice success">${escapeHtml(this.notice)}</div>` : ''}
            ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}<button data-retry>重试</button></div>` : ''}
            ${this.renderFilters()}
            <div class="data-panel"><div class="table-scroll"><table><thead><tr><th>直播间</th><th>房主</th><th>科室 / 疾病</th><th>置顶</th><th>状态</th><th>开始时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
            <div class="pagination"><span>共 ${this.total} 条</span><button data-page="prev" ${this.page <= 1 ? 'disabled' : ''}>上一页</button><b>${this.page} / ${pages}</b><button data-page="next" ${this.page >= pages ? 'disabled' : ''}>下一页</button></div>
        </section>`;
        this.bindEvents(canManage);
    }

    private renderFilters(): string {
        return `<form class="filter-bar live-filters" data-filter>
            <label>房间编码<input name="roomCode" value="${escapeHtml(this.filters.roomCode)}" placeholder="LR..." /></label>
            <label>标题<input name="title" value="${escapeHtml(this.filters.title)}" placeholder="直播间标题" /></label>
            <label>状态<select name="status"><option value="">全部</option><option value="1" ${this.filters.status === '1' ? 'selected' : ''}>启用</option><option value="0" ${this.filters.status === '0' ? 'selected' : ''}>停用</option><option value="2" ${this.filters.status === '2' ? 'selected' : ''}>封禁</option></select></label>
            <label>置顶<select name="isTop"><option value="">全部</option><option value="1" ${this.filters.isTop === '1' ? 'selected' : ''}>已置顶</option><option value="0" ${this.filters.isTop === '0' ? 'selected' : ''}>未置顶</option></select></label>
            <button class="secondary-button" type="submit">查询</button><button class="text-button" type="reset" data-reset-filter>重置</button>
        </form>`;
    }

    /** 绑定筛选、分页和写操作，避免只读管理员发出变更请求。 */
    private bindEvents(canManage: boolean): void {
        this.querySelector('[data-retry]')?.addEventListener('click', () => void this.load());
        this.querySelector<HTMLFormElement>('[data-filter]')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            this.filters = {
                roomCode: formValue(data, 'roomCode'), title: formValue(data, 'title'),
                status: formValue(data, 'status'), isTop: formValue(data, 'isTop'),
            };
            this.page = 1;
            void this.load();
        });
        this.querySelector('[data-reset-filter]')?.addEventListener('click', () => {
            this.filters = { roomCode: '', title: '', status: '', isTop: '' };
            this.page = 1;
            void this.load();
        });
        this.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => button.addEventListener('click', () => {
            this.page += button.dataset.page === 'next' ? 1 : -1;
            void this.load();
        }));
        if (!canManage) return;
        this.querySelector('[data-create]')?.addEventListener('click', () => this.openEditor());
        this.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => {
            void this.handleAction(button.dataset.action ?? '', Number(button.dataset.id));
        }));
    }

    /** 分派直播间编辑、归属、置顶、状态和删除操作。 */
    private async handleAction(action: string, id: number): Promise<void> {
        const room = this.rooms.find((item) => item.id === id);
        if (!room) return;
        if (action === 'edit') return this.openEditor(id);
        if (action === 'owner') return this.openOwnerEditor(room);
        if (!window.confirm(action === 'delete' ? '删除后直播间及其直播流无法恢复，确认继续？' : '确认执行该操作？')) return;
        if (action === 'top') return this.run(() => liveApi.setRoomTop(id, room.isTop === 1 ? 0 : 1), '置顶状态已更新');
        if (action === 'status') return this.run(() => liveApi.setRoomStatus(id, room.status === 1 ? 0 : 1), '直播间状态已更新');
        if (action === 'delete') await this.run(() => liveApi.deleteRoom(id), '直播间已删除');
    }

    /** 新增时直接打开空表单；编辑时先读取带直播流的详情和封面记录。 */
    private async openEditor(id?: number): Promise<void> {
        try {
            const room = id ? await liveApi.room(id) : undefined;
            const cover = room?.coverFileId ? await liveApi.file(room.coverFileId) : undefined;
            this.showEditor(room, cover);
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    private showEditor(room?: LiveRoomDetail, cover?: FileObject): void {
        const streams: LiveRoomStreamInput[] = room?.streams.map((stream) => ({
            id: stream.id,
            streamName: stream.streamName,
            title: stream.title ?? '',
            sortNo: stream.sortNo,
            isDefault: stream.isDefault,
            status: stream.status,
        })) ?? [{ streamName: '', title: '', sortNo: 0, isDefault: 1, status: 1 }];
        const dialog = openDialog(this, `<form class="dialog-card live-room-dialog">
            <header><div><h3>${room ? '编辑直播间' : '新增直播间'}</h3><p>房间与完整直播流列表将一次提交</p></div><button type="button" class="dialog-close" data-close>×</button></header>
            <div class="dialog-fields">
                <label class="span-2">直播标题<input name="title" required value="${escapeHtml(room?.title)}" /></label>
                <label class="span-2">直播说明<textarea name="description">${escapeHtml(room?.description)}</textarea></label>
                <label>科室 ID<input name="departmentId" type="number" min="1" value="${room?.departmentId ?? ''}" /></label>
                <label>疾病 ID<input name="diseaseId" type="number" min="1" value="${room?.diseaseId ?? ''}" /></label>
                <label>开始时间<input name="startTime" type="datetime-local" value="${inputDateTime(room?.startTime)}" /></label>
                <label>状态<select name="status"><option value="1" ${room?.status !== 0 && room?.status !== 2 ? 'selected' : ''}>启用</option><option value="0" ${room?.status === 0 ? 'selected' : ''}>停用</option><option value="2" ${room?.status === 2 ? 'selected' : ''}>封禁</option></select></label>
                <label>置顶<select name="isTop"><option value="0" ${room?.isTop !== 1 ? 'selected' : ''}>否</option><option value="1" ${room?.isTop === 1 ? 'selected' : ''}>是</option></select></label>
                <label>直播封面<input name="coverFile" type="file" accept="image/*" /><input name="coverFileId" type="hidden" value="${room?.coverFileId ?? ''}" /></label>
                <div class="cover-preview span-2" data-cover-preview>${this.coverPreview(cover)}</div>
                <div class="stream-editor span-2"><div class="stream-editor-heading"><div><strong>直播流</strong><small>至少保留一路，同一房间只能有一路默认流</small></div><button class="secondary-button" type="button" data-add-stream>＋ 添加一路</button></div><div data-stream-list></div></div>
            </div><p class="dialog-error" data-dialog-error></p>
            <footer><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button">保存直播间</button></footer>
        </form>`);
        this.renderStreamRows(dialog, streams);
        dialog.querySelector('[data-add-stream]')?.addEventListener('click', () => {
            this.syncStreamRows(dialog, streams);
            streams.push({ streamName: '', title: '', sortNo: streams.length, isDefault: 0, status: 1 });
            this.renderStreamRows(dialog, streams);
        });
        this.bindCoverUpload(dialog);
        this.bindEditorSubmit(dialog, room?.id);
    }

    private coverPreview(file?: FileObject): string {
        if (!file) return '<span>未上传封面</span>';
        return `<img src="${escapeHtml(file.fileUrl)}" alt="${escapeHtml(file.fileName)}" /><div><strong>${escapeHtml(file.fileName)}</strong><small>文件 ID ${file.id}</small></div>`;
    }

    /** 重绘直播流行，并同步删除和默认流选择到内存列表。 */
    private renderStreamRows(dialog: HTMLDialogElement, streams: LiveRoomStreamInput[]): void {
        const list = dialog.querySelector<HTMLElement>('[data-stream-list]');
        if (!list) return;
        list.innerHTML = streams.map((stream, index) => `<div class="stream-row" data-stream-row data-id="${stream.id ?? ''}">
            <label>Stream Name<input name="streamName" required value="${escapeHtml(stream.streamName)}" /></label>
            <label>显示标题<input name="streamTitle" value="${escapeHtml(stream.title)}" /></label>
            <label>排序<input name="sortNo" type="number" value="${stream.sortNo ?? index}" /></label>
            <label>状态<select name="streamStatus"><option value="1" ${stream.status !== 0 ? 'selected' : ''}>启用</option><option value="0" ${stream.status === 0 ? 'selected' : ''}>停用</option></select></label>
            <label class="default-stream"><input type="radio" name="defaultStream" value="${index}" ${stream.isDefault === 1 ? 'checked' : ''} /> 默认流</label>
            <button class="text-button danger" type="button" data-remove-stream="${index}" ${streams.length === 1 ? 'disabled' : ''}>移除</button>
        </div>`).join('');
        list.querySelectorAll<HTMLButtonElement>('[data-remove-stream]').forEach((button) => button.addEventListener('click', () => {
            this.syncStreamRows(dialog, streams);
            const index = Number(button.dataset.removeStream);
            const removedDefault = streams[index]?.isDefault === 1;
            streams.splice(index, 1);
            if (removedDefault && streams[0]) streams[0].isDefault = 1;
            this.renderStreamRows(dialog, streams);
        }));
    }

    /** 在增删行前保存当前输入，避免重绘直播流列表时丢失尚未提交的编辑内容。 */
    private syncStreamRows(dialog: HTMLDialogElement, streams: LiveRoomStreamInput[]): void {
        const defaultIndex = Number(dialog.querySelector<HTMLInputElement>('[name="defaultStream"]:checked')?.value ?? 0);
        const current = Array.from(dialog.querySelectorAll<HTMLElement>('[data-stream-row]')).map((row, index) => ({
            id: optionalNumber(row.dataset.id ?? ''),
            streamName: row.querySelector<HTMLInputElement>('[name="streamName"]')?.value ?? '',
            title: row.querySelector<HTMLInputElement>('[name="streamTitle"]')?.value ?? '',
            sortNo: Number(row.querySelector<HTMLInputElement>('[name="sortNo"]')?.value ?? index),
            isDefault: index === defaultIndex ? 1 : 0,
            status: Number(row.querySelector<HTMLSelectElement>('[name="streamStatus"]')?.value ?? 1),
        }));
        streams.splice(0, streams.length, ...current);
    }

    /** 上传成功后直接使用 Handler 返回的 FileObject 更新隐藏 ID 和封面预览。 */
    private bindCoverUpload(dialog: HTMLDialogElement): void {
        dialog.querySelector<HTMLInputElement>('[name="coverFile"]')?.addEventListener('change', (event) => {
            const input = event.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            input.disabled = true;
            void liveApi.uploadFile(file).then((uploaded) => {
                const idInput = dialog.querySelector<HTMLInputElement>('[name="coverFileId"]');
                if (idInput) idInput.value = String(uploaded.id);
                const preview = dialog.querySelector<HTMLElement>('[data-cover-preview]');
                if (preview) preview.innerHTML = this.coverPreview(uploaded);
            }).catch((error) => {
                const errorBox = dialog.querySelector<HTMLElement>('[data-dialog-error]');
                if (errorBox) errorBox.textContent = errorMessage(error);
            }).finally(() => { input.disabled = false; });
        });
    }

    /** 把动态直播流行转换为后端的完整 streams 数组并提交。 */
    private bindEditorSubmit(dialog: HTMLDialogElement, id?: number): void {
        dialog.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;
            const data = new FormData(form);
            const defaultIndex = Number(formValue(data, 'defaultStream') || 0);
            const streams = Array.from(form.querySelectorAll<HTMLElement>('[data-stream-row]')).map((row, index) => ({
                id: optionalNumber(row.dataset.id ?? ''),
                streamName: row.querySelector<HTMLInputElement>('[name="streamName"]')?.value.trim() ?? '',
                title: row.querySelector<HTMLInputElement>('[name="streamTitle"]')?.value.trim() || undefined,
                sortNo: Number(row.querySelector<HTMLInputElement>('[name="sortNo"]')?.value ?? index),
                isDefault: index === defaultIndex ? 1 : 0,
                status: Number(row.querySelector<HTMLSelectElement>('[name="streamStatus"]')?.value ?? 1),
            }));
            const input: LiveRoomInput = {
                title: formValue(data, 'title'),
                description: formValue(data, 'description') || undefined,
                coverFileId: optionalNumber(formValue(data, 'coverFileId')),
                departmentId: optionalNumber(formValue(data, 'departmentId')),
                diseaseId: optionalNumber(formValue(data, 'diseaseId')),
                startTime: apiDateTime(formValue(data, 'startTime')),
                isTop: Number(formValue(data, 'isTop')),
                status: Number(formValue(data, 'status')),
                streams,
            };
            const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            if (button) button.disabled = true;
            const save = id ? liveApi.updateRoom(id, input) : liveApi.createRoom(input);
            void save.then(() => {
                dialog.remove();
                this.notice = id ? '直播间已更新' : '直播间已创建';
                void this.load();
            }).catch((error) => {
                const errorBox = dialog.querySelector<HTMLElement>('[data-dialog-error]');
                if (errorBox) errorBox.textContent = errorMessage(error);
                if (button) button.disabled = false;
            });
        });
    }

    /** 房主变更只提交普通用户或管理员其中一个 ID。 */
    private openOwnerEditor(room: LiveRoom): void {
        const type = room.ownerUserId ? 'user' : 'admin';
        const dialog = openDialog(this, `<form class="dialog-card"><header><div><h3>变更房主</h3><p>${escapeHtml(room.title)}</p></div><button type="button" class="dialog-close" data-close>×</button></header><div class="dialog-fields">
            <label>房主类型<select name="ownerType"><option value="admin" ${type === 'admin' ? 'selected' : ''}>管理员</option><option value="user" ${type === 'user' ? 'selected' : ''}>普通用户</option></select></label>
            <label>房主 ID<input name="ownerId" type="number" min="1" required value="${room.ownerAdminId ?? room.ownerUserId ?? ''}" /></label>
        </div><p class="dialog-error" data-dialog-error></p><footer><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button">确认变更</button></footer></form>`);
        dialog.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            const ownerId = Number(formValue(data, 'ownerId'));
            const userOwner = formValue(data, 'ownerType') === 'user';
            void liveApi.changeRoomOwner(room.id, userOwner ? ownerId : undefined, userOwner ? undefined : ownerId)
                .then(() => { dialog.remove(); this.notice = '房主已变更'; void this.load(); })
                .catch((error) => {
                    const errorBox = dialog.querySelector<HTMLElement>('[data-dialog-error]');
                    if (errorBox) errorBox.textContent = errorMessage(error);
                });
        });
    }

    /** 统一处理行操作错误并在成功后刷新列表。 */
    private async run(action: () => Promise<unknown>, success: string): Promise<void> {
        try {
            await action();
            this.notice = success;
            await this.load();
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }
}

customElements.define('live-management-page', LiveManagementPage);
