import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import { logger } from '../common/logger';
import '../components/live-player';
import type { LivePlayerComponent, LivePlayerSource } from '../components/live-player';
import type { GeneratedLiveStreamUrls, LiveRoomDetail } from '../types';
import { errorMessage, escapeHtml } from './management-shared';
import { isTencentStreamActive } from './live-runtime';

type PlayState = 'loading' | 'pending' | 'offline' | 'live' | 'error';

/** 管理员观看页，始终从运行信息接口重新确认实际活动链路。 */
export class LivePlayPage extends HTMLElement {
    private roomId: number | null = null;
    private room: LiveRoomDetail | null = null;
    private activeStream: GeneratedLiveStreamUrls | null = null;
    private state: PlayState = 'loading';
    private message = '';
    private statusTimer: ReturnType<typeof setInterval> | null = null;

    connectedCallback(): void {
        this.render();
    }

    disconnectedCallback(): void {
        this.stopStatusMonitor();
    }

    async update(roomId: number): Promise<void> {
        this.stopStatusMonitor();
        this.roomId = roomId;
        this.state = 'loading';
        this.message = '';
        this.render();
        try {
            this.room = await liveApi.room(roomId);
            const runtime = await liveApi.liveRuntime(roomId);
            if (!runtime.activeStreamId) {
                this.state = 'offline';
                this.message = '当前直播间未开播';
                this.render();
                return;
            }
            this.activeStream = runtime.streams.find((stream) => stream.streamId === runtime.activeStreamId) ?? null;
            if (!this.activeStream) {
                this.state = 'offline';
                this.message = '当前直播间未开播';
                this.render();
                return;
            }
            const result = await liveApi.roomStreamState(roomId, runtime.activeStreamId);
            if (!isTencentStreamActive(result.Response)) {
                this.state = 'offline';
                this.message = '当前直播间未开播';
                this.render();
                return;
            }
            this.state = 'live';
            this.message = '正在连接直播';
            this.render();
            await this.startPlayback();
            this.startStatusMonitor();
        } catch (error) {
            this.state = error instanceof ApiError && error.status === 404 ? 'pending' : 'error';
            this.message = this.state === 'pending' ? '直播运行信息接口暂未接入' : errorMessage(error);
            this.render();
        }
    }

    private render(): void {
        const title = this.room?.title ?? '观看直播';
        const roomCode = this.room?.roomCode ?? (this.roomId ? `直播间 #${this.roomId}` : '直播间');
        this.innerHTML = `<section class="management-page live-console live-play-page">
            <div class="live-console-hero play-hero"><div><span class="console-kicker">LIVE VIEWING ROOM</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(roomCode)} · 当前活动链路由主播推流状态决定</p></div>
                <span class="console-live-indicator ${this.state === 'live' ? 'on' : ''}"><i></i>${this.state === 'live' ? '直播中' : '未在播放'}</span></div>
            <div class="live-console-grid play-grid">
                <div class="live-console-main">
                    <article class="console-card player-card">${this.renderPlayer()}</article>
                    <article class="console-card stream-summary-card">${this.renderStreamSummary()}</article>
                </div>
                <aside class="live-console-side">
                    ${this.renderPlaceholder('直播二维码', '二维码生成地址将在后续接口中补充', 'qr')}
                    ${this.renderPlaceholder('直播聊天室', 'HTTPS + Server-Sent Events 接口待接入', 'chat')}
                </aside>
            </div>
        </section>`;
        this.bindEvents();
    }

    private renderPlayer(): string {
        if (this.state === 'live') {
            return `<live-player></live-player><div class="player-overlay-status"><span data-play-status>${escapeHtml(this.message)}</span><button type="button" data-play-again>开始播放</button></div>`;
        }
        const message = this.state === 'loading' ? '正在读取直播状态' : this.message || '当前直播间未开播';
        return `<div class="player-empty-state"><span class="player-empty-icon">▶</span><strong>${escapeHtml(message)}</strong><p>${this.state === 'pending' ? '页面结构已完成，等待后端补充运行信息接口。' : '请稍后刷新或返回观看列表。'}</p></div>`;
    }

    private renderStreamSummary(): string {
        if (!this.activeStream) {
            return '<header><span>当前活动链路</span></header><p class="console-muted">尚未获取到主播实际推送的链路</p>';
        }
        return `<header><span>当前活动链路</span><small>${this.activeStream.isDefault ? '默认流' : '主播选择流'}</small></header>
            <div class="active-stream-details"><strong>${escapeHtml(this.activeStream.title || this.activeStream.streamName)}</strong><span>${escapeHtml(this.activeStream.streamCode)} · ${escapeHtml(this.activeStream.streamName)}</span></div>`;
    }

    private renderPlaceholder(title: string, description: string, kind: 'qr' | 'chat'): string {
        return `<article class="console-card placeholder-card" data-${kind}-placeholder><div class="placeholder-visual ${kind}">${kind === 'qr' ? 'QR' : '•••'}</div><div><strong>${title}</strong><p>${description}</p><span>功能待接入</span></div></article>`;
    }

    private bindEvents(): void {
        this.querySelector('[data-play-again]')?.addEventListener('click', () => void this.startPlayback());
        this.player()?.addEventListener('live-player-status', (event) => {
            const detail = (event as CustomEvent<{ message: string }>).detail;
            const status = this.querySelector<HTMLElement>('[data-play-status]');
            if (status) status.textContent = detail.message;
        });
    }

    /** 按 WebRTC、FLV、HLS 顺序交给播放器准备降级来源。 */
    private async startPlayback(): Promise<void> {
        const player = this.player();
        if (!player || !this.activeStream) return;
        const started = await player.playSources(this.playSources(this.activeStream));
        const button = this.querySelector<HTMLButtonElement>('[data-play-again]');
        if (button) button.hidden = started;
    }

    /** 播放期间定期确认活动链路仍存在；仅 Play 页面轮询，列表页面不轮询。 */
    private startStatusMonitor(): void {
        this.stopStatusMonitor();
        this.statusTimer = setInterval(() => void this.verifyStillLive(), 15_000);
    }

    private stopStatusMonitor(): void {
        if (this.statusTimer) clearInterval(this.statusTimer);
        this.statusTimer = null;
    }

    /** 活动链路被清除、切换或腾讯云停播时立即释放播放器。 */
    private async verifyStillLive(): Promise<void> {
        if (!this.roomId || !this.activeStream) return;
        try {
            const runtime = await liveApi.liveRuntime(this.roomId);
            if (runtime.activeStreamId !== this.activeStream.streamId) {
                this.finishPlayback();
                return;
            }
            const result = await liveApi.roomStreamState(this.roomId, this.activeStream.streamId);
            if (!isTencentStreamActive(result.Response)) this.finishPlayback();
        } catch (error) {
            logger.warn('live playback status refresh failed', {
                roomId: this.roomId,
                streamId: this.activeStream.streamId,
                errorType: error instanceof Error ? error.name : typeof error,
            });
        }
    }

    private finishPlayback(): void {
        this.stopStatusMonitor();
        this.player()?.destroy();
        this.activeStream = null;
        this.state = 'offline';
        this.message = '直播已结束';
        this.render();
    }

    /** 过滤空地址，避免把无效来源交给腾讯播放器。 */
    private playSources(stream: GeneratedLiveStreamUrls): LivePlayerSource[] {
        return [
            { src: stream.playWebrtc, type: 'webrtc' },
            { src: stream.playFlv, type: 'video/x-flv' },
            { src: stream.playHls, type: 'application/x-mpegURL' },
        ].filter((source) => Boolean(source.src));
    }

    private player(): LivePlayerComponent | null {
        return this.querySelector<LivePlayerComponent>('live-player');
    }
}

if (!customElements.get('live-play-page')) {
    customElements.define('live-play-page', LivePlayPage);
}
