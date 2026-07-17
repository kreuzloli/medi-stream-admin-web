import '../libs/tcplayer/tcplayer.min.css';
import tcPlayerUrl from '../libs/tcplayer/tcplayer.v5.3.3.min.js?url';
import { logger } from '../common/logger';

export interface LivePlayerSource {
    src: string;
    type?: string;
}

type TCPlayerInstance = {
    src: (sources: LivePlayerSource[]) => void;
    play: () => void | Promise<void>;
    pause: () => void;
    dispose: () => void;
};

type TCPlayerFactory = (id: string, options: {
    licenseUrl: string;
    width: string;
    height: string;
    controls: boolean;
    autoplay: boolean;
    muted: boolean;
    preload: 'auto' | 'metadata' | 'none';
    language: 'zh-CN' | 'en';
    sources: LivePlayerSource[];
}) => TCPlayerInstance;

declare global {
    interface Window {
        TCPlayer?: TCPlayerFactory;
    }
}

/** 封装腾讯云播放器，支持 WebRTC 优先及 FLV/HLS 备用来源。 */
export class LivePlayerComponent extends HTMLElement {
    private static scriptPromise: Promise<void> | null = null;
    private static nextId = 1;

    private readonly playerId = `tc-admin-live-player-${LivePlayerComponent.nextId++}`;
    private player: TCPlayerInstance | null = null;
    private initPromise: Promise<boolean> | null = null;

    connectedCallback(): void {
        this.render();
    }

    disconnectedCallback(): void {
        this.destroy();
    }

    /** 初始化播放器并按顺序提交所有可用播放来源。 */
    async playSources(sources: LivePlayerSource[]): Promise<boolean> {
        if (sources.length === 0) {
            this.emitStatus('没有可用的直播播放地址', 'error');
            return false;
        }
        if (!await this.init() || !this.player) return false;
        try {
            this.player.src(sources);
            await this.player.play();
            this.emitStatus('直播播放已开始', 'success');
            return true;
        } catch (error) {
            logger.warn('live playback start failed', {
                sourceCount: sources.length,
                errorType: error instanceof Error ? error.name : typeof error,
            });
            this.emitStatus('浏览器阻止了自动播放，请点击开始播放', 'error');
            return false;
        }
    }

    pause(): void {
        this.player?.pause();
        this.emitStatus('直播已暂停', 'normal');
    }

    /** 销毁播放器并释放媒体资源；允许重复调用。 */
    destroy(): void {
        if (!this.player) return;
        this.player.dispose();
        this.player = null;
        this.initPromise = null;
    }

    private async init(): Promise<boolean> {
        if (this.player) return true;
        this.initPromise ??= this.createPlayer();
        try {
            return await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    private async createPlayer(): Promise<boolean> {
        try {
            await LivePlayerComponent.loadScript();
        } catch (error) {
            logger.error('live player sdk load failed', {
                errorType: error instanceof Error ? error.name : typeof error,
            });
            this.emitStatus('播放器脚本加载失败', 'error');
            return false;
        }
        if (!window.TCPlayer || !this.isConnected) return false;
        this.player = window.TCPlayer(this.playerId, {
            licenseUrl: '/api/live/license',
            width: '100%',
            height: '100%',
            controls: true,
            autoplay: false,
            muted: false,
            preload: 'auto',
            language: 'zh-CN',
            sources: [],
        });
        return true;
    }

    private static loadScript(): Promise<void> {
        if (window.TCPlayer) return Promise.resolve();
        if (LivePlayerComponent.scriptPromise) return LivePlayerComponent.scriptPromise;
        LivePlayerComponent.scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = tcPlayerUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('TCPlayer SDK load failed'));
            document.head.append(script);
        });
        return LivePlayerComponent.scriptPromise;
    }

    private emitStatus(message: string, type: 'normal' | 'success' | 'error'): void {
        this.dispatchEvent(new CustomEvent('live-player-status', {
            detail: { message, type }, bubbles: true, composed: true,
        }));
    }

    private render(): void {
        this.innerHTML = `<div class="live-player-frame"><video id="${this.playerId}" preload="auto" playsinline></video></div>`;
    }
}

if (!customElements.get('live-player')) {
    customElements.define('live-player', LivePlayerComponent);
}
