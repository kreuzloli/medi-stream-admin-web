import { liveApi } from '../api/live';
import type { LiveUrls } from '../types';
import { errorMessage, escapeHtml, formValue } from './management-shared';

/** 腾讯云直播运维工具页，生成短期地址并代理查询实时流状态。 */
export class TencentLivePage extends HTMLElement {
    private urls: LiveUrls | null = null;
    private state: unknown = null;
    private error = '';

    connectedCallback(): void {
        this.render();
    }

    private render(): void {
        this.innerHTML = `<section class="management-page tencent-live-page">
            <div class="management-titlebar"><div><h2>腾讯云直播</h2><p>敏感签名由管理端服务生成，浏览器只接收短期推拉流地址</p></div></div>
            ${this.error ? `<div class="page-notice error">${escapeHtml(this.error)}</div>` : ''}
            <div class="live-tool-grid">
                <article class="live-tool-card"><header><h3>生成直播地址</h3><p>输入腾讯云 streamName，按需调整有效期和转码模板。</p></header>
                    <form class="dialog-fields live-tool-form" data-url-form>
                        <label class="span-2">Stream Name<input name="streamName" required placeholder="例如 operation-main" /></label>
                        <label>有效期（秒）<input name="ttlSeconds" type="number" min="1" placeholder="使用服务端默认值" /></label>
                        <label>转码模板<input name="transcodeTemplate" placeholder="可选" /></label>
                        <button class="primary-button span-2" type="submit">生成地址</button>
                    </form>${this.urls ? this.renderUrls(this.urls) : '<p class="live-tool-empty">生成结果将在此显示</p>'}</article>
                <article class="live-tool-card"><header><h3>查询直播状态</h3><p>通过腾讯云 OpenAPI 查询指定流当前状态。</p></header>
                    <form class="dialog-fields live-tool-form" data-state-form>
                        <label>App Name<input name="appName" required /></label><label>推流域名<input name="domainName" required /></label>
                        <label class="span-2">Stream Name<input name="streamName" required /></label>
                        <button class="secondary-button span-2" type="submit">查询状态</button>
                    </form>${this.state ? `<pre class="live-state-result">${escapeHtml(JSON.stringify(this.state, null, 2))}</pre>` : '<p class="live-tool-empty">查询结果将在此显示</p>'}</article>
            </div></section>`;
        this.bindEvents();
    }

    private renderUrls(urls: LiveUrls): string {
        const values = [['RTMP 推流', urls.pushRtmp], ['WebRTC 推流', urls.pushWebrtc], ['HLS 播放', urls.playHls], ['FLV 播放', urls.playFlv], ['RTMP 播放', urls.playRtmp], ['WebRTC 播放', urls.playWebrtc]];
        return `<div class="live-url-list">${values.map(([label, value]) => `<div><span>${label}</span><code>${escapeHtml(value)}</code><button type="button" data-copy="${escapeHtml(value)}">复制</button></div>`).join('')}</div>`;
    }

    private bindEvents(): void {
        this.querySelector<HTMLFormElement>('[data-url-form]')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            const ttl = formValue(data, 'ttlSeconds');
            void liveApi.generateUrls({ streamName: formValue(data, 'streamName'), ttlSeconds: ttl ? Number(ttl) : undefined, transcodeTemplate: formValue(data, 'transcodeTemplate') || undefined })
                .then((urls) => { this.urls = urls; this.error = ''; this.render(); })
                .catch((error) => { this.error = errorMessage(error); this.render(); });
        });
        this.querySelector<HTMLFormElement>('[data-state-form]')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            void liveApi.streamState({ AppName: formValue(data, 'appName'), DomainName: formValue(data, 'domainName'), StreamName: formValue(data, 'streamName') })
                .then((result) => { this.state = result.Response; this.error = ''; this.render(); })
                .catch((error) => { this.error = errorMessage(error); this.render(); });
        });
        this.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => button.addEventListener('click', () => void navigator.clipboard?.writeText(button.dataset.copy ?? '')));
    }
}

customElements.define('tencent-live-page', TencentLivePage);
