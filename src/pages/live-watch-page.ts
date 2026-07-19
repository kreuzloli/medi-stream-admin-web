import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import { navigate } from '../router/routes';
import type { FileObject, LiveRoom } from '../types';
import { emptyRows, errorMessage, escapeHtml, loadingRows } from './management-shared';

type WatchStatus = 'loading' | 'live' | 'offline' | 'error';

/** 管理员观看列表，状态只在加载和手动刷新时查询，不持续轮询腾讯云。 */
export class LiveWatchPage extends HTMLElement {
    private rooms: LiveRoom[] = [];
    private statuses = new Map<number, WatchStatus>();
    private coverFiles = new Map<number, FileObject>();
    private loading = false;
    private error = '';
    private notice = '';

    connectedCallback(): void {
        this.render();
    }

    /** 加载全部启用房间，并行补充运行状态和封面文件信息。 */
    async update(): Promise<void> {
        this.loading = true;
        this.error = '';
        this.render();
        try {
            const result = await liveApi.rooms({ page: 1, size: 200, status: 1 });
            this.rooms = result.records;
            this.rooms.forEach((room) => this.statuses.set(room.id, 'loading'));
            this.render();
            await Promise.all([this.refreshStatuses(), this.loadCoverFiles()]);
        } catch (error) {
            this.error = errorMessage(error);
        } finally {
            this.loading = false;
            this.render();
        }
    }

    /** 批量读取后端聚合状态；无运行时缓存或 isLive=false 均视为未开播。 */
    private async refreshStatuses(): Promise<void> {
        await Promise.all(this.rooms.map(async (room) => {
            this.statuses.set(room.id, 'loading');
            try {
                const runtime = await liveApi.liveRuntime(room.id);
                this.statuses.set(room.id, runtime.isLive ? 'live' : 'offline');
            } catch (error) {
                this.statuses.set(room.id, error instanceof ApiError && error.status === 404 ? 'offline' : 'error');
            }
        }));
    }

    private render(): void {
        const rows = this.loading && this.rooms.length === 0
            ? loadingRows(4)
            : this.rooms.length === 0
                ? emptyRows(4, '暂无直播间')
                : this.rooms.map((room) => `<tr>
                    <td>${this.roomIdentity(room)}</td>
                    <td>${this.statusBadge(this.statuses.get(room.id) ?? 'offline')}</td>
                    <td>${room.startTime ? escapeHtml(room.startTime) : '—'}</td>
                    <td class="row-actions"><button class="primary-action" type="button" data-watch="${room.id}">观看</button></td>
                </tr>`).join('');
        this.innerHTML = `<section class="management-page live-watch-page">
            <div class="management-titlebar"><div><h2>观看直播</h2><p>查看直播间状态，并进入管理员直播观看页</p></div><button class="secondary-button" type="button" data-refresh-status>刷新状态</button></div>
            ${this.notice ? `<div class="page-notice info">${escapeHtml(this.notice)}</div>` : ''}
            ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}</div>` : ''}
            <div class="data-panel"><div class="table-scroll"><table><thead><tr><th>直播间</th><th>直播状态</th><th>计划开播时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        </section>`;
        this.bindEvents();
    }

    private statusBadge(status: WatchStatus): string {
        if (status === 'live') return '<span class="status-badge enabled"><i></i>直播中</span>';
        if (status === 'offline') return '<span class="status-badge disabled"><i></i>未开播</span>';
        if (status === 'loading') return '<span class="status-badge pending"><i></i>查询中</span>';
        if (status === 'error') return '<span class="status-badge banned"><i></i>查询失败</span>';
        return '<span class="status-badge disabled"><i></i>未开播</span>';
    }

    /** 只读取观看列表中唯一的封面文件，失败项继续使用占位图。 */
    private async loadCoverFiles(): Promise<void> {
        this.coverFiles.clear();
        const coverFileIds = [...new Set(this.rooms
            .map((room) => room.coverFileId)
            .filter((id): id is number => id !== null && id !== undefined))];
        await Promise.all(coverFileIds.map(async (id) => {
            try {
                this.coverFiles.set(id, await liveApi.file(id));
            } catch {
                // 封面加载失败不影响管理员查看直播状态和进入观看页。
            }
        }));
    }

    /** 组合观看列表中的封面、标题和房间编码。 */
    private roomIdentity(room: LiveRoom): string {
        const cover = room.coverFileId ? this.coverFiles.get(room.coverFileId) : undefined;
        const visual = cover
            ? `<img src="${escapeHtml(cover.fileUrl)}" alt="${escapeHtml(room.title)}封面" loading="lazy" />`
            : '<span class="live-room-cover-placeholder" aria-hidden="true">直播</span>';
        return `<div class="live-room-list-identity"><span class="live-room-list-cover">${visual}</span><div class="primary-cell"><strong>${escapeHtml(room.title)}</strong><small>${escapeHtml(room.roomCode)}</small></div></div>`;
    }

    private bindEvents(): void {
        this.querySelector('[data-refresh-status]')?.addEventListener('click', () => void this.reloadStatuses());
        this.querySelectorAll<HTMLButtonElement>('[data-watch]').forEach((button) => {
            button.addEventListener('click', () => void this.watch(Number(button.dataset.watch)));
        });
    }

    /** 手动刷新一次状态，避免持续轮询腾讯云。 */
    private async reloadStatuses(): Promise<void> {
        this.notice = '正在刷新直播状态';
        this.render();
        await this.refreshStatuses();
        this.notice = '直播状态已刷新';
        this.render();
    }

    /** 观看前再次确认活动链路仍在直播，避免进入失效播放页。 */
    private async watch(roomId: number): Promise<void> {
        try {
            const runtime = await liveApi.liveRuntime(roomId);
            if (!runtime.activeStreamId || !runtime.isLive) {
                this.notice = '当前直播间未开播';
                this.render();
                return;
            }
            navigate(`/live/play?roomId=${roomId}`);
        } catch (error) {
            this.notice = error instanceof ApiError && error.status === 404
                ? '当前直播间未开播'
                : errorMessage(error);
            this.render();
        }
    }
}

if (!customElements.get('live-watch-page')) {
    customElements.define('live-watch-page', LiveWatchPage);
}
