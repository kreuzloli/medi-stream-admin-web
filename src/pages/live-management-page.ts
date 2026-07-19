import { liveApi, type LiveRoomInput, type LiveRoomStreamInput } from '../api/live';
import { ApiError } from '../api/http';
import { managementApi } from '../api/management';
import { sessionStore } from '../auth/session';
import { navigate } from '../router/routes';
import type {
    Administrator,
    Department,
    Disease,
    FileObject,
    LiveRoom,
    LiveRoomDetail,
    UserInfo,
} from '../types';
import {
    emptyRows,
    errorMessage,
    escapeHtml,
    formValue,
    formatDate,
    loadingRows,
    openDialog,
} from './management-shared';

type LiveRuntimeStatus = 'loading' | 'live' | 'offline' | 'error';

/** 把可选数字字段转换为 API 使用的 undefined，避免把空输入提交为 0。 */
function optionalNumber(value: string): number | undefined {
    return value === '' ? undefined : Number(value);
}

/** 把后端时间拆成日期、小时和分钟，供三个可选择控件分别回显。 */
function startTimeParts(value?: string | null): { date: string; hour: string; minute: string } {
    const normalized = value?.replace(' ', 'T') ?? '';
    return {
        date: normalized.slice(0, 10),
        hour: normalized.slice(11, 13) || '00',
        minute: normalized.slice(14, 16) || '00',
    };
}

/** 把日期、小时和分钟重新组合成 Rust NaiveDateTime 接收的完整值。 */
function composeStartTime(date: string, hour: string, minute: string): string | undefined {
    return date ? `${date}T${hour}:${minute}:00` : undefined;
}

function timeOptions(count: number, selected: string): string {
    return Array.from({ length: count }, (_, value) => String(value).padStart(2, '0'))
        .map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`)
        .join('');
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
    private runtimeStatuses = new Map<number, LiveRuntimeStatus>();
    private departmentNames = new Map<number, string>();
    private diseaseNames = new Map<number, string>();
    private coverFiles = new Map<number, FileObject>();
    private catalogLoadFailed = false;

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
            this.rooms.forEach((room) => this.runtimeStatuses.set(room.id, 'loading'));
            await Promise.all([this.queryLiveStatuses(), this.loadCatalogNames(), this.loadCoverFiles()]);
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
        const canPush = sessionStore.can('TENCENT_LIVE_MANAGE');
        const rows = this.loading ? loadingRows(9) : this.rooms.length === 0 ? emptyRows(9, '暂无直播间')
            : this.rooms.map((room) => `<tr>
                <td>${this.roomIdentity(room)}</td>
                <td>${room.ownerAdminId ? `管理员 #${room.ownerAdminId}` : `用户 #${room.ownerUserId ?? '—'}`}</td>
                <td>${this.catalogLabel(room)}</td>
                <td>${room.isTop === 1 ? '<span class="status-badge enabled"><i></i>已置顶</span>' : '普通'}</td>
                <td>${roomStatusBadge(room.status)}</td><td>${this.runtimeStatusBadge(this.runtimeStatuses.get(room.id) ?? 'offline')}</td><td>${formatDate(room.startTime)}</td><td>${formatDate(room.updatedAt)}</td>
                <td class="row-actions">
                    ${canPush ? `<button class="primary-action" data-action="push" data-id="${room.id}">开播</button>` : ''}
                    <button data-action="watch" data-id="${room.id}">观看</button>
                    ${canManage ? `
                    <button data-action="edit" data-id="${room.id}">编辑</button>
                    <button data-action="owner" data-id="${room.id}">房主</button>
                    <button data-action="top" data-id="${room.id}">${room.isTop === 1 ? '取消置顶' : '置顶'}</button>
                    <button data-action="status" data-id="${room.id}">${room.status === 1 ? '停用' : '启用'}</button>
                    <button class="danger" data-action="delete" data-id="${room.id}">删除</button>` : ''}</td>
            </tr>`).join('');
        const pages = Math.max(1, Math.ceil(this.total / 20));
        this.innerHTML = `<section class="management-page live-management-page">
            <div class="management-titlebar"><div><h2>直播间管理</h2><p>维护直播间信息、封面和多路腾讯云直播流</p></div><div class="titlebar-actions"><button class="secondary-button" data-refresh-live-status>刷新直播状态</button>${canManage ? '<button class="primary-button" data-create>＋ 新增直播间</button>' : ''}</div></div>
            ${this.notice ? `<div class="page-notice success">${escapeHtml(this.notice)}</div>` : ''}
            ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}<button data-retry>重试</button></div>` : ''}
            ${this.renderFilters()}
            <div class="data-panel"><div class="table-scroll"><table><thead><tr><th>直播间</th><th>房主</th><th>科室 / 疾病</th><th>置顶</th><th>业务状态</th><th>直播状态</th><th>开播时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
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
        this.querySelector('[data-refresh-live-status]')?.addEventListener('click', () => void this.refreshLiveStatuses());
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
        if (canManage) this.querySelector('[data-create]')?.addEventListener('click', () => this.openEditor());
        this.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => {
            void this.handleAction(button.dataset.action ?? '', Number(button.dataset.id));
        }));
    }

    /** 直接使用运行信息聚合的腾讯云状态；无运行时缓存视为未开播。 */
    private async queryLiveStatuses(): Promise<void> {
        await Promise.all(this.rooms.map(async (room) => {
            try {
                const runtime = await liveApi.liveRuntime(room.id);
                this.runtimeStatuses.set(room.id, runtime.isLive ? 'live' : 'offline');
            } catch (error) {
                this.runtimeStatuses.set(
                    room.id,
                    error instanceof ApiError && error.status === 404 ? 'offline' : 'error',
                );
            }
        }));
    }

    private async refreshLiveStatuses(): Promise<void> {
        this.rooms.forEach((room) => this.runtimeStatuses.set(room.id, 'loading'));
        this.render();
        await this.queryLiveStatuses();
        this.render();
    }

    private runtimeStatusBadge(status: LiveRuntimeStatus): string {
        if (status === 'live') return '<span class="status-badge enabled"><i></i>直播中</span>';
        if (status === 'offline') return '<span class="status-badge disabled"><i></i>未开播</span>';
        if (status === 'loading') return '<span class="status-badge pending"><i></i>查询中</span>';
        if (status === 'error') return '<span class="status-badge banned"><i></i>查询失败</span>';
        return '<span class="status-badge disabled"><i></i>未开播</span>';
    }

    /** 只读取当前页唯一的封面文件，单张文件失败时保留列表和占位图。 */
    private async loadCoverFiles(): Promise<void> {
        this.coverFiles.clear();
        const coverFileIds = [...new Set(this.rooms
            .map((room) => room.coverFileId)
            .filter((id): id is number => id !== null && id !== undefined))];
        await Promise.all(coverFileIds.map(async (id) => {
            try {
                this.coverFiles.set(id, await liveApi.file(id));
            } catch {
                // 封面是列表补充信息，加载失败不能阻断直播间管理操作。
            }
        }));
    }

    /** 组合列表封面和直播间主次信息；无有效文件时显示稳定占位。 */
    private roomIdentity(room: LiveRoom): string {
        const cover = room.coverFileId ? this.coverFiles.get(room.coverFileId) : undefined;
        const visual = cover
            ? `<img src="${escapeHtml(cover.fileUrl)}" alt="${escapeHtml(room.title)}封面" loading="lazy" />`
            : '<span class="live-room-cover-placeholder" aria-hidden="true">直播</span>';
        return `<div class="live-room-list-identity"><span class="live-room-list-cover">${visual}</span><div class="primary-cell"><strong>${escapeHtml(room.title)}</strong><small>${escapeHtml(room.roomCode)}</small></div></div>`;
    }

    /** 为当前页涉及的目录建立名称映射，同一科室的疾病列表只读取一次。 */
    private async loadCatalogNames(): Promise<void> {
        this.departmentNames.clear();
        this.diseaseNames.clear();
        this.catalogLoadFailed = false;
        try {
            const departments = await liveApi.departments();
            departments.forEach((department) => this.departmentNames.set(department.id, department.deptName));
            const departmentIds = [...new Set(this.rooms
                .map((room) => room.departmentId)
                .filter((id): id is number => id !== null && id !== undefined))];
            await Promise.all(departmentIds.map(async (departmentId) => {
                const diseases = await liveApi.diseases(departmentId);
                diseases.forEach((disease) => this.diseaseNames.set(disease.id, disease.diseaseName));
            }));
        } catch {
            this.catalogLoadFailed = true;
        }
    }

    /** 列表只展示业务名称；失效历史关联也不回退暴露数据库 ID。 */
    private catalogLabel(room: LiveRoom): string {
        if (this.catalogLoadFailed) return '名称加载失败';
        if (!room.departmentId && !room.diseaseId) return '—';
        const department = room.departmentId ? this.departmentNames.get(room.departmentId) ?? '未知科室' : '—';
        const disease = room.diseaseId ? this.diseaseNames.get(room.diseaseId) ?? '未知疾病' : '—';
        return `${escapeHtml(department)} / ${escapeHtml(disease)}`;
    }

    /** 分派直播间编辑、归属、置顶、状态和删除操作。 */
    private async handleAction(action: string, id: number): Promise<void> {
        const room = this.rooms.find((item) => item.id === id);
        if (!room) return;
        if (action === 'push') return navigate(`/live/push?roomId=${id}`);
        if (action === 'watch') return this.openWatch(id);
        if (action === 'edit') return this.openEditor(id);
        if (action === 'owner') return this.openOwnerEditor(room);
        if (!window.confirm(action === 'delete' ? '删除后直播间及其直播流无法恢复，确认继续？' : '确认执行该操作？')) return;
        if (action === 'top') return this.run(() => liveApi.setRoomTop(id, room.isTop === 1 ? 0 : 1), '置顶状态已更新');
        if (action === 'status') return this.run(() => liveApi.setRoomStatus(id, room.status === 1 ? 0 : 1), '直播间状态已更新');
        if (action === 'delete') await this.run(() => liveApi.deleteRoom(id), '直播间已删除');
    }

    /** 观看前使用后端聚合状态确认活动链路确实正在直播。 */
    private async openWatch(roomId: number): Promise<void> {
        try {
            const runtime = await liveApi.liveRuntime(roomId);
            if (!runtime.activeStreamId || !runtime.isLive) {
                this.error = '当前直播间未开播';
                this.render();
                return;
            }
            navigate(`/live/play?roomId=${roomId}`);
        } catch (error) {
            this.error = error instanceof ApiError && error.status === 404
                ? '当前直播间未开播'
                : errorMessage(error);
            this.render();
        }
    }

    /** 新增时直接打开空表单；编辑时先读取带直播流的详情和封面记录。 */
    private async openEditor(id?: number): Promise<void> {
        try {
            const [room, departments] = await Promise.all([
                id ? liveApi.room(id) : Promise.resolve(undefined),
                liveApi.departments(),
            ]);
            const [cover, diseases] = await Promise.all([
                room?.coverFileId ? liveApi.file(room.coverFileId) : Promise.resolve(undefined),
                room?.departmentId ? liveApi.diseases(room.departmentId) : Promise.resolve([]),
            ]);
            this.showEditor(room, cover, departments, diseases);
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    private showEditor(
        room: LiveRoomDetail | undefined,
        cover: FileObject | undefined,
        departments: Department[],
        diseases: Disease[],
    ): void {
        const startTime = startTimeParts(room?.startTime);
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
                <label>科室<select name="departmentId"><option value="">未选择科室</option>${this.departmentOptions(departments, room?.departmentId)}</select></label>
                <label>疾病<select name="diseaseId" ${room?.departmentId ? '' : 'disabled'}>${this.diseaseOptions(diseases, room?.diseaseId)}</select></label>
                <label class="span-2">开播时间<div class="broadcast-time-control"><input name="startDate" type="date" value="${startTime.date}" /><select name="startHour" aria-label="开播小时">${timeOptions(24, startTime.hour)}</select><span>时</span><select name="startMinute" aria-label="开播分钟">${timeOptions(60, startTime.minute)}</select><span>分</span></div></label>
                <label>状态<select name="status"><option value="1" ${room?.status !== 0 && room?.status !== 2 ? 'selected' : ''}>启用</option><option value="0" ${room?.status === 0 ? 'selected' : ''}>停用</option><option value="2" ${room?.status === 2 ? 'selected' : ''}>封禁</option></select></label>
                <label>置顶<select name="isTop"><option value="0" ${room?.isTop !== 1 ? 'selected' : ''}>否</option><option value="1" ${room?.isTop === 1 ? 'selected' : ''}>是</option></select></label>
                <label class="span-2 cover-upload-field"><span>直播封面</span><div class="file-upload-control"><input name="coverFile" type="file" accept="image/*" /><span>支持常见图片格式，上传成功后自动关联</span></div><input name="coverFileId" type="hidden" value="${room?.coverFileId ?? ''}" /></label>
                <div class="cover-preview span-2" data-cover-preview>${this.coverPreview(cover)}</div>
                <div class="stream-editor span-2"><div class="stream-editor-heading"><div><strong>直播流</strong><small>至少保留一路，同一房间只能有一路默认流</small></div><button class="secondary-button" type="button" data-add-stream>＋ 添加一路</button></div><div data-stream-list></div></div>
            </div><p class="dialog-error" data-dialog-error></p>
            <footer><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button">保存直播间</button></footer>
        </form>`);
        this.renderStreamRows(dialog, streams);
        this.bindCatalogSelectors(dialog);
        dialog.querySelector('[data-add-stream]')?.addEventListener('click', () => {
            this.syncStreamRows(dialog, streams);
            const nextSortNo = streams.reduce(
                (highest, stream) => Math.max(highest, stream.sortNo ?? 0),
                0,
            ) + 1;
            streams.push({ streamName: '', title: '', sortNo: nextSortNo, isDefault: 0, status: 1 });
            this.renderStreamRows(dialog, streams);
        });
        this.bindCoverUpload(dialog);
        this.bindEditorSubmit(dialog, room?.id);
    }

    /** 科室下拉展示名称；已停用但当前正在使用的科室仍允许回显。 */
    private departmentOptions(departments: Department[], selectedId?: number | null): string {
        return departments
            .filter((department) => department.status === 1 || department.id === selectedId)
            .map((department) => `<option value="${department.id}" ${department.id === selectedId ? 'selected' : ''}>${escapeHtml(department.deptName)}${department.status === 1 ? '' : '（已停用）'}</option>`)
            .join('');
    }

    /** 疾病下拉始终限制在当前科室内，并用名称替代数据库 ID。 */
    private diseaseOptions(diseases: Disease[], selectedId?: number | null): string {
        return `<option value="">未选择疾病</option>${diseases
            .filter((disease) => disease.status === 1 || disease.id === selectedId)
            .map((disease) => `<option value="${disease.id}" ${disease.id === selectedId ? 'selected' : ''}>${escapeHtml(disease.diseaseName)}${disease.status === 1 ? '' : '（已停用）'}</option>`)
            .join('')}`;
    }

    /** 科室变化后重新查询疾病候选项，避免提交不属于该科室的疾病。 */
    private bindCatalogSelectors(dialog: HTMLDialogElement): void {
        const department = dialog.querySelector<HTMLSelectElement>('[name="departmentId"]');
        const disease = dialog.querySelector<HTMLSelectElement>('[name="diseaseId"]');
        department?.addEventListener('change', () => {
            if (!disease) return;
            const departmentId = optionalNumber(department.value);
            disease.disabled = !departmentId;
            disease.innerHTML = '<option value="">正在加载...</option>';
            if (!departmentId) {
                disease.innerHTML = this.diseaseOptions([]);
                return;
            }
            void liveApi.diseases(departmentId).then((diseases) => {
                disease.innerHTML = this.diseaseOptions(diseases);
            }).catch((error) => {
                disease.innerHTML = '<option value="">加载失败</option>';
                const errorBox = dialog.querySelector<HTMLElement>('[data-dialog-error]');
                if (errorBox) errorBox.textContent = errorMessage(error);
            });
        });
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
                startTime: composeStartTime(
                    formValue(data, 'startDate'),
                    formValue(data, 'startHour'),
                    formValue(data, 'startMinute'),
                ),
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

    /** 房主候选项展示业务名称，提交时仍只传普通用户或管理员其中一个 ID。 */
    private openOwnerEditor(room: LiveRoom): void {
        const type = room.ownerUserId ? 'user' : 'admin';
        const dialog = openDialog(this, `<form class="dialog-card"><header><div><h3>变更房主</h3><p>${escapeHtml(room.title)}</p></div><button type="button" class="dialog-close" data-close>×</button></header><div class="dialog-fields">
            <label>房主类型<select name="ownerType"><option value="admin" ${type === 'admin' ? 'selected' : ''}>管理员</option><option value="user" ${type === 'user' ? 'selected' : ''}>普通用户</option></select></label>
            <label>选择房主<select name="ownerId" required disabled><option value="">正在加载...</option></select></label>
        </div><p class="dialog-error" data-dialog-error></p><footer><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button" disabled>确认变更</button></footer></form>`);
        const ownerType = dialog.querySelector<HTMLSelectElement>('[name="ownerType"]')!;
        const owner = dialog.querySelector<HTMLSelectElement>('[name="ownerId"]')!;
        const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        const errorBox = dialog.querySelector<HTMLElement>('[data-dialog-error]')!;
        let requestVersion = 0;

        /** 切换房主类型时重新加载候选项，避免沿用另一类型的 ID。 */
        const loadOwners = async (): Promise<void> => {
            const version = ++requestVersion;
            const ownerKind = ownerType.value;
            owner.disabled = true;
            submit.disabled = true;
            owner.innerHTML = '<option value="">正在加载...</option>';
            errorBox.textContent = '';
            try {
                const currentId = ownerKind === type ? room.ownerAdminId ?? room.ownerUserId ?? undefined : undefined;
                const candidates = await this.loadOwnerCandidates(ownerKind);
                if (version !== requestVersion) return;
                owner.innerHTML = this.ownerOptions(ownerKind, candidates, currentId);
                owner.disabled = false;
                submit.disabled = owner.value === '';
            } catch (error) {
                if (version !== requestVersion) return;
                owner.innerHTML = '<option value="">候选项加载失败</option>';
                errorBox.textContent = errorMessage(error);
            }
        };
        ownerType.addEventListener('change', () => void loadOwners());
        owner.addEventListener('change', () => { submit.disabled = owner.value === ''; });
        void loadOwners();
        dialog.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            const ownerId = Number(formValue(data, 'ownerId'));
            if (!ownerId) {
                errorBox.textContent = '请选择房主';
                return;
            }
            const userOwner = formValue(data, 'ownerType') === 'user';
            submit.disabled = true;
            void liveApi.changeRoomOwner(room.id, userOwner ? ownerId : undefined, userOwner ? undefined : ownerId)
                .then(() => { dialog.remove(); this.notice = '房主已变更'; void this.load(); })
                .catch((error) => {
                    errorBox.textContent = errorMessage(error);
                    submit.disabled = false;
                });
        });
    }

    /** 分页读取全部房主候选，避免超过单页上限后只能选择前 200 条。 */
    private async loadOwnerCandidates(type: string): Promise<Array<Administrator | UserInfo>> {
        const loadPage = (page: number) => type === 'user'
            ? managementApi.users({ page, size: 200 })
            : managementApi.admins({ page, size: 200 });
        const first = await loadPage(1);
        const candidates: Array<Administrator | UserInfo> = [...first.records];
        if (first.pages <= 1) return candidates;
        const remaining = await Promise.all(
            Array.from({ length: first.pages - 1 }, (_, index) => loadPage(index + 2)),
        );
        remaining.forEach((page) => candidates.push(...page.records));
        return candidates;
    }

    /** 构造房主名称选项，并允许已停用但当前绑定的房主继续回显。 */
    private ownerOptions(
        type: string,
        candidates: Array<Administrator | UserInfo>,
        selectedId?: number,
    ): string {
        const options = candidates
            .filter((candidate) => candidate.status === 1 || candidate.id === selectedId)
            .map((candidate) => {
                const label = type === 'user'
                    ? this.userOwnerLabel(candidate as UserInfo)
                    : `${(candidate as Administrator).realName}（${(candidate as Administrator).username}）`;
                const suffix = candidate.status === 1 ? '' : '（已停用）';
                const selected = candidate.id === selectedId ? 'selected' : '';
                return `<option value="${candidate.id}" ${selected}>${escapeHtml(label)}${suffix}</option>`;
            })
            .join('');
        return `<option value="">请选择房主</option>${options}`;
    }

    /** 普通用户优先显示昵称，同时保留真实姓名或用户编码用于辨识。 */
    private userOwnerLabel(user: UserInfo): string {
        const nickname = user.nickname?.trim();
        if (nickname) return `${nickname}（${user.realName}）`;
        return user.userCode ? `${user.realName}（${user.userCode}）` : user.realName;
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
