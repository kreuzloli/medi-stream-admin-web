import { ApiError } from '../api/http';
import { liveApi } from '../api/live';
import { logger } from '../common/logger';
import '../components/live-pusher';
import type { LivePusherComponent, LivePusherStatus } from '../components/live-pusher';
import type {
    GeneratedLiveRoomUrls,
    GeneratedLiveStreamUrls,
    LiveRoomDetail,
    TencentLiveConfigOption,
} from '../types';
import { errorMessage, escapeHtml } from './management-shared';

/** 管理员直播控制台：选择配置、生成全链路 URL，并选择其中一路实际推流。 */
export class LivePushPage extends HTMLElement {
    private roomId: number | null = null;
    private room: LiveRoomDetail | null = null;
    private configs: TencentLiveConfigOption[] = [];
    private urls: GeneratedLiveRoomUrls | null = null;
    private selectedStreamId: number | null = null;
    private loading = false;
    private pushing = false;
    private error = '';
    private notice = '';

    connectedCallback(): void {
        this.render();
    }

    /** 页面离开时尽力清除服务端活动链路，避免观看端继续显示已经结束的直播。 */
    disconnectedCallback(): void {
        if (this.pushing && this.roomId) {
            const roomId = this.roomId;
            void liveApi.setActiveStream(roomId, null).catch((error) => {
                logger.warn('active live stream cleanup failed', {
                    roomId,
                    errorType: error instanceof Error ? error.name : typeof error,
                });
            });
        }
    }

    /** 使用路由中的房间 ID 初始化页面；房间和配置可并行读取。 */
    async update(roomId: number): Promise<void> {
        this.roomId = roomId;
        this.loading = true;
        this.error = '';
        this.render();
        try {
            const runtimePromise = liveApi.liveRuntime(roomId).catch((error) => {
                if (error instanceof ApiError && error.status === 404) return null;
                throw error;
            });
            const [room, configs, runtime] = await Promise.all([
                liveApi.room(roomId),
                liveApi.liveConfigs(),
                runtimePromise,
            ]);
            this.room = room;
            this.configs = configs;
            if (runtime) {
                this.urls = runtime;
                this.selectedStreamId = runtime.activeStreamId
                    ?? runtime.streams.find((stream) => stream.isDefault)?.streamId
                    ?? runtime.streams[0]?.streamId
                    ?? null;
                logger.info('live room runtime restored', {
                    roomId,
                    activeStreamId: runtime.activeStreamId,
                    streamCount: runtime.streams.length,
                });
                this.notice = '已恢复直播间上次生成的运行信息';
            }
        } catch (error) {
            this.error = errorMessage(error);
        } finally {
            this.loading = false;
            this.render();
        }
    }

    private render(): void {
        if (this.loading) {
            this.innerHTML = '<section class="management-page live-console"><div class="console-loading"><span class="brand-loader"></span>正在加载直播控制台</div></section>';
            return;
        }
        if (!this.roomId) {
            this.innerHTML = '<section class="management-page"><div class="page-notice error">缺少有效的直播间 ID</div></section>';
            return;
        }
        if (!this.room) {
            this.innerHTML = `<section class="management-page"><div class="page-notice error"><span>${escapeHtml(this.error || '直播间加载失败')}</span><button type="button" data-retry-load>重新加载</button></div></section>`;
            this.querySelector('[data-retry-load]')?.addEventListener('click', () => void this.update(this.roomId!));
            return;
        }

        this.innerHTML = `<section class="management-page live-console live-push-page">
            <div class="live-console-hero">
                <div><span class="console-kicker">LIVE PUSH CONSOLE</span><h2>${escapeHtml(this.room.title)}</h2>
                    <p>${escapeHtml(this.room.roomCode)} · 选择配置后一次生成全部启用链路，再选择一路开始推流。</p></div>
                <span class="console-live-indicator ${this.pushing ? 'on' : ''}"><i></i>${this.pushing ? '正在推流' : '尚未推流'}</span>
            </div>
            ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}</div>` : ''}
            <div class="page-notice info ${this.notice ? '' : 'is-hidden'}" data-live-notice>${escapeHtml(this.notice)}</div>
            <div class="live-console-grid">
                <div class="live-console-main">
                    <article class="console-card preview-card">
                        <live-pusher></live-pusher>
                        ${this.renderPusherControls()}
                    </article>
                    ${this.urls ? this.renderUrlResults(this.urls) : '<article class="console-card empty-console-card"><strong>等待生成直播地址</strong><p>选择配置后，系统将一次生成当前房间全部启用链路的推流和播放地址。</p></article>'}
                </div>
                <aside class="live-console-side">
                    ${this.renderConfigCard()}
                    ${this.renderStreamCard()}
                    ${this.renderPlaceholder('直播二维码', '二维码生成地址将在后续接口中补充', 'qr')}
                    ${this.renderPlaceholder('直播聊天室', 'HTTPS + Server-Sent Events 接口待接入', 'chat')}
                </aside>
            </div>
        </section>`;
        this.bindEvents();
        this.syncControls();
    }

    /** 配置卡只展示安全字段，生成动作必须由管理员显式触发。 */
    private renderConfigCard(): string {
        const selectedConfigId = this.urls?.liveConfigId ?? this.configs[0]?.id ?? '';
        return `<article class="console-card compact-card"><header><span>直播配置</span><small>签名密钥仅在服务端使用</small></header>
            <form data-generate-form>
                <label>URL 生成配置<select name="liveConfigId" required>
                    <option value="">请选择配置</option>
                    ${this.configs.map((config) => `<option value="${config.id}" ${config.id === selectedConfigId ? 'selected' : ''}>${escapeHtml(config.name)} · ${escapeHtml(config.appName)}</option>`).join('')}
                </select></label>
                <button class="primary-button wide-button" type="submit" data-generate>生成 / 更新直播地址</button>
            </form>
        </article>`;
    }

    /** 展示本次生成结果中的全部链路，并保持默认流优先。 */
    private renderStreamCard(): string {
        if (!this.urls) {
            return '<article class="console-card compact-card"><header><span>推流链路</span><small>生成地址后可选择</small></header><p class="console-muted">暂无可选链路</p></article>';
        }
        return `<article class="console-card compact-card"><header><span>推流链路</span><small>一次只能推送一路</small></header>
            <div class="stream-choice-list">${this.urls.streams.map((stream) => `
                <label class="stream-choice ${stream.streamId === this.selectedStreamId ? 'selected' : ''}">
                    <input type="radio" name="streamId" value="${stream.streamId}" ${stream.streamId === this.selectedStreamId ? 'checked' : ''} />
                    <span><strong>${escapeHtml(stream.title || stream.streamName)}</strong><small>${escapeHtml(stream.streamCode)} · ${escapeHtml(stream.streamName)}${stream.isDefault ? ' · 默认流' : ''}</small></span>
                </label>`).join('')}</div>
        </article>`;
    }

    private renderPusherControls(): string {
        return `<div class="pusher-control-bar">
            <label>采集模式<select name="captureMode"><option value="camera">摄像头 + 麦克风</option><option value="screen">屏幕分享</option></select></label>
            <label>视频质量<select name="videoQuality"><option value="480p">480p</option><option value="720p" selected>720p</option><option value="1080p">1080p</option></select></label>
            <div class="pusher-actions">
                <button type="button" data-start-preview>开启预览</button>
                <button type="button" data-stop-preview>关闭预览</button>
                <button type="button" class="live-start-button" data-start-push>开始推流</button>
                <button type="button" data-stop-push>停止推流</button>
            </div>
            <p class="pusher-status" data-pusher-status>等待操作</p>
        </div>`;
    }

    private renderUrlResults(urls: GeneratedLiveRoomUrls): string {
        return `<article class="console-card url-result-card"><header><div><span>全部直播地址</span><small>${urls.streams.length} 路链路 · 配置 #${urls.liveConfigId}</small></div><time>有效至 ${new Date(urls.expireAtEpochSeconds * 1000).toLocaleString('zh-CN')}</time></header>
            <div class="stream-url-groups">${urls.streams.map((stream) => this.renderStreamUrls(stream)).join('')}</div>
        </article>`;
    }

    private renderStreamUrls(stream: GeneratedLiveStreamUrls): string {
        const values: Array<[string, string | null | undefined]> = [
            ['WebRTC 推流', stream.pushWebrtc], ['RTMP 推流', stream.pushRtmp],
            ['WebRTC 播放', stream.playWebrtc], ['RTMP 播放', stream.playRtmp],
            ['FLV 播放', stream.playFlv], ['HLS 播放', stream.playHls],
            ['转码 FLV', stream.playFlvTranscoded], ['转码 HLS', stream.playHlsTranscoded],
        ];
        return `<section class="stream-url-group"><div class="stream-url-heading"><div><strong>${escapeHtml(stream.title || stream.streamName)}</strong><small>${escapeHtml(stream.streamCode)} · ${escapeHtml(stream.streamName)}</small></div>${stream.isDefault ? '<span>默认流</span>' : ''}</div>
            <div class="live-url-list">${values.filter(([, value]) => Boolean(value)).map(([label, value]) => `<div><span>${label}</span><code>${escapeHtml(value)}</code><button type="button" data-copy="${escapeHtml(value)}">复制</button></div>`).join('')}</div>
        </section>`;
    }

    private renderPlaceholder(title: string, description: string, kind: 'qr' | 'chat'): string {
        return `<article class="console-card placeholder-card" data-${kind}-placeholder><div class="placeholder-visual ${kind}">${kind === 'qr' ? 'QR' : '•••'}</div><div><strong>${title}</strong><p>${description}</p><span>功能待接入</span></div></article>`;
    }

    /** 绑定配置生成、链路切换、推流控制和地址复制交互。 */
    private bindEvents(): void {
        const form = this.querySelector<HTMLFormElement>('[data-generate-form]');
        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            const configId = Number(new FormData(form).get('liveConfigId'));
            if (configId > 0) void this.generateUrls(configId);
        });
        this.querySelector<HTMLSelectElement>('[name="liveConfigId"]')?.addEventListener('change', () => {
            this.syncControls();
        });
        this.querySelectorAll<HTMLInputElement>('[name="streamId"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.selectedStreamId = Number(input.value);
                this.querySelectorAll('.stream-choice').forEach((choice) => choice.classList.remove('selected'));
                input.closest('.stream-choice')?.classList.add('selected');
            });
        });
        this.querySelector('[data-start-preview]')?.addEventListener('click', () => void this.startPreview());
        this.querySelector('[data-stop-preview]')?.addEventListener('click', () => this.pusher()?.stopPreview());
        this.querySelector('[data-start-push]')?.addEventListener('click', () => void this.startPush());
        this.querySelector('[data-stop-push]')?.addEventListener('click', () => void this.stopPush());
        this.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
            button.addEventListener('click', () => void this.copyUrl(button.dataset.copy ?? ''));
        });
        this.pusher()?.addEventListener('live-pusher-status', (event) => {
            const status = (event as CustomEvent<LivePusherStatus>).detail;
            const element = this.querySelector<HTMLElement>('[data-pusher-status]');
            if (element) {
                element.textContent = status.message;
                element.dataset.type = status.type;
            }
        });
    }

    /** 使用一个配置刷新房间全部启用链路，失败时不伪造生成成功状态。 */
    private async generateUrls(liveConfigId: number): Promise<void> {
        if (!this.roomId || this.pushing) return;
        this.error = '';
        try {
            this.urls = await liveApi.generateRoomUrls(this.roomId, { liveConfigId });
            this.selectedStreamId = this.urls.streams.find((stream) => stream.isDefault)?.streamId
                ?? this.urls.streams[0]?.streamId
                ?? null;
            this.notice = `已生成 ${this.urls.streams.length} 路直播地址`;
            this.render();
        } catch (error) {
            this.error = errorMessage(error);
            this.render();
        }
    }

    /** 按页面选择的采集模式启动本地预览。 */
    private async startPreview(): Promise<void> {
        const captureMode = this.querySelector<HTMLSelectElement>('[name="captureMode"]')?.value === 'screen'
            ? 'screen' : 'camera';
        const videoQuality = this.querySelector<HTMLSelectElement>('[name="videoQuality"]')?.value ?? '720p';
        await this.pusher()?.startPreview({ videoQuality, audioQuality: 'standard', captureMode });
    }

    /** 仅推送当前链路，并在 SDK 成功后同步活动链路。 */
    private async startPush(): Promise<void> {
        const stream = this.selectedStream();
        const selectedConfigId = Number(this.querySelector<HTMLSelectElement>('[name="liveConfigId"]')?.value);
        if (!stream || !this.roomId || this.pushing || selectedConfigId !== this.urls?.liveConfigId) return;
        const started = await this.pusher()?.startPush(stream.pushWebrtc);
        if (!started) return;
        this.pushing = true;
        this.syncControls();
        try {
            await liveApi.setActiveStream(this.roomId, stream.streamId);
            logger.info('administrator live push started', { roomId: this.roomId, streamId: stream.streamId });
            this.setNotice(`正在推送：${stream.title || stream.streamName}`);
        } catch (error) {
            this.pusher()?.stopPush();
            this.pushing = false;
            this.syncControls();
            logger.warn('active live stream synchronization failed; local push stopped', {
                roomId: this.roomId,
                streamId: stream.streamId,
                errorType: error instanceof Error ? error.name : typeof error,
            });
            this.setNotice(`活动链路同步失败，推流已停止：${errorMessage(error)}`);
        }
    }

    /** 停止 SDK 推流后清除服务端活动链路，并明确提示清理失败。 */
    private async stopPush(): Promise<void> {
        if (!this.roomId) return;
        const streamId = this.selectedStreamId;
        this.pusher()?.stopPush();
        this.pushing = false;
        this.syncControls();
        logger.info('administrator live push stopped', { roomId: this.roomId, streamId });
        try {
            await liveApi.setActiveStream(this.roomId, null);
            this.setNotice('推流已停止');
        } catch (error) {
            logger.warn('active live stream cleanup failed after local push stopped', {
                roomId: this.roomId,
                streamId,
                errorType: error instanceof Error ? error.name : typeof error,
            });
            this.setNotice(`推流已停止；活动链路清理失败：${errorMessage(error)}`);
        }
    }

    private selectedStream(): GeneratedLiveStreamUrls | undefined {
        return this.urls?.streams.find((stream) => stream.streamId === this.selectedStreamId);
    }

    private pusher(): LivePusherComponent | null {
        return this.querySelector<LivePusherComponent>('live-pusher');
    }

    private syncControls(): void {
        const config = this.querySelector<HTMLSelectElement>('[name="liveConfigId"]');
        if (config) config.disabled = this.pushing;
        this.querySelectorAll<HTMLInputElement>('[name="streamId"]').forEach((input) => {
            input.disabled = this.pushing;
        });
        const generate = this.querySelector<HTMLButtonElement>('[data-generate]');
        if (generate) generate.disabled = this.pushing;
        const start = this.querySelector<HTMLButtonElement>('[data-start-push]');
        const selectedConfigId = Number(config?.value);
        if (start) start.disabled = this.pushing
            || !this.selectedStream()
            || selectedConfigId !== this.urls?.liveConfigId;
        const stop = this.querySelector<HTMLButtonElement>('[data-stop-push]');
        if (stop) stop.disabled = !this.pushing;
    }

    private setNotice(message: string): void {
        this.notice = message;
        const notice = this.querySelector<HTMLElement>('[data-live-notice]');
        if (notice) {
            notice.textContent = message;
            notice.classList.remove('is-hidden');
        }
    }

    private async copyUrl(value: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
            this.setNotice('直播地址已复制');
        } catch {
            this.setNotice('复制失败，请手动选择地址');
        }
    }
}

if (!customElements.get('live-push-page')) {
    customElements.define('live-push-page', LivePushPage);
}
