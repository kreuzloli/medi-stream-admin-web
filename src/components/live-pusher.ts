import txLivePusherUrl from '../libs/txlivepusher/TXLivePusher-2.1.1.min.js?url';
import { logger } from '../common/logger';

export type LivePusherStatus = {
    message: string;
    type: 'normal' | 'success' | 'error';
};

type TXSupportResult = {
    isWebRTCSupported: boolean;
    isMediaDevicesSupported: boolean;
};

type TXLivePusherObserver = {
    onError?: (code: number, message: string) => void;
    onWarning?: (code: number, message: string) => void;
    onPushStatusUpdate?: (status: number, message: string) => void;
    onStatisticsUpdate?: (statistics: object) => void;
};

type TXLivePusherInstance = {
    setRenderView: (container: HTMLDivElement) => void;
    setVideoQuality: (quality: string) => void;
    setAudioQuality: (quality: string) => void;
    setProperty: (key: string, value: unknown) => void;
    startCamera: () => Promise<string>;
    stopCamera: (streamId?: string) => void;
    startMicrophone: () => Promise<string>;
    stopMicrophone: (streamId?: string) => void;
    startScreenCapture: () => Promise<string>;
    stopScreenCapture: (streamId?: string) => void;
    startPush: (pushUrl: string) => Promise<void>;
    stopPush: () => void;
    pauseVideo: () => void;
    pauseAudio: () => void;
    resumeVideo: () => void;
    resumeAudio: () => void;
    setObserver: (observer: TXLivePusherObserver) => void;
    destroy: () => void;
};

type TXLivePusherConstructor = {
    new (): TXLivePusherInstance;
    checkSupport: () => Promise<TXSupportResult>;
};

declare global {
    interface Window {
        TXLivePusher?: TXLivePusherConstructor;
    }
}

/** 封装腾讯云 Web 推流 SDK，并确保页面卸载时释放采集设备。 */
export class LivePusherComponent extends HTMLElement {
    private static scriptPromise: Promise<void> | null = null;

    private pusher: TXLivePusherInstance | null = null;
    private initPromise: Promise<boolean> | null = null;
    private cameraStreamId: string | null = null;
    private microphoneStreamId: string | null = null;
    private screenStreamId: string | null = null;

    connectedCallback(): void {
        this.render();
    }

    disconnectedCallback(): void {
        this.destroy();
    }

    /** 检查浏览器是否同时支持 WebRTC 和媒体设备采集。 */
    async checkSupport(): Promise<boolean> {
        try {
            await LivePusherComponent.loadScript();
            if (!window.TXLivePusher) {
                this.emitStatus('推流 SDK 加载失败', 'error');
                return false;
            }
            const result = await window.TXLivePusher.checkSupport();
            if (!result.isWebRTCSupported) {
                this.emitStatus('当前浏览器不支持 WebRTC 推流', 'error');
                return false;
            }
            if (!result.isMediaDevicesSupported) {
                this.emitStatus('当前浏览器不支持摄像头或麦克风采集', 'error');
                return false;
            }
            this.emitStatus('当前浏览器支持 Web 推流', 'success');
            return true;
        } catch (error) {
            logger.warn('live pusher support check failed', { errorType: this.errorType(error) });
            this.emitStatus('推流 SDK 加载失败', 'error');
            return false;
        }
    }

    /** 按摄像头或屏幕模式开启本地预览。 */
    async startPreview(options: {
        videoQuality: string;
        audioQuality: string;
        captureMode: 'camera' | 'screen';
    }): Promise<boolean> {
        if (!await this.init() || !this.pusher || !await this.checkSupport()) return false;
        this.stopPreview();
        this.pusher.setVideoQuality(options.videoQuality);
        this.pusher.setAudioQuality(options.audioQuality);
        this.pusher.setProperty('enableLog', false);
        try {
            if (options.captureMode === 'screen') {
                this.screenStreamId = await this.pusher.startScreenCapture();
                this.emitStatus('屏幕采集已开启', 'success');
                return true;
            }
            this.cameraStreamId = await this.pusher.startCamera();
            this.microphoneStreamId = await this.pusher.startMicrophone();
            this.emitStatus('摄像头和麦克风预览已开启', 'success');
            return true;
        } catch (error) {
            this.stopPreview();
            logger.warn('live pusher preview failed', { errorType: this.errorType(error) });
            this.emitStatus(this.errorMessage(error, '打开采集失败，请检查浏览器权限'), 'error');
            return false;
        }
    }

    /** 使用当前链路的 WebRTC 地址开始推流，并把成功结果返回给页面。 */
    async startPush(pushUrl: string): Promise<boolean> {
        if (!pushUrl.startsWith('webrtc://')) {
            this.emitStatus('Web 在线推流只支持 webrtc:// 地址', 'error');
            return false;
        }
        if (!await this.init() || !this.pusher) return false;
        try {
            await this.pusher.startPush(pushUrl);
            this.emitStatus('推流已开始', 'success');
            return true;
        } catch (error) {
            logger.warn('live push start failed', { errorType: this.errorType(error) });
            this.emitStatus(this.errorMessage(error, '推流失败，请检查浏览器和网络'), 'error');
            return false;
        }
    }

    /** 停止云端推流；未初始化时保持幂等。 */
    stopPush(): void {
        this.pusher?.stopPush();
        this.emitStatus('推流已停止', 'normal');
    }

    /** 停止所有本地采集源并清空 SDK 流 ID。 */
    stopPreview(): void {
        if (!this.pusher) return;
        if (this.cameraStreamId) this.pusher.stopCamera(this.cameraStreamId);
        if (this.microphoneStreamId) this.pusher.stopMicrophone(this.microphoneStreamId);
        if (this.screenStreamId) this.pusher.stopScreenCapture(this.screenStreamId);
        this.cameraStreamId = null;
        this.microphoneStreamId = null;
        this.screenStreamId = null;
    }

    muteVideo(): void { this.pusher?.pauseVideo(); }
    resumeVideo(): void { this.pusher?.resumeVideo(); }
    muteAudio(): void { this.pusher?.pauseAudio(); }
    resumeAudio(): void { this.pusher?.resumeAudio(); }

    /** 停止推流和采集后销毁 SDK，允许组件安全重复卸载。 */
    destroy(): void {
        if (!this.pusher) return;
        try {
            this.pusher.stopPush();
            this.stopPreview();
            this.pusher.destroy();
        } finally {
            this.pusher = null;
            this.initPromise = null;
        }
    }

    private async init(): Promise<boolean> {
        if (this.pusher) return true;
        this.initPromise ??= this.createPusher();
        try {
            return await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    private async createPusher(): Promise<boolean> {
        const container = this.querySelector<HTMLDivElement>('[data-pusher-preview]');
        if (!container) return false;
        try {
            await LivePusherComponent.loadScript();
        } catch (error) {
            logger.error('live pusher sdk load failed', { errorType: this.errorType(error) });
            this.emitStatus('推流 SDK 加载失败', 'error');
            return false;
        }
        if (!window.TXLivePusher || !this.isConnected) return false;
        this.pusher = new window.TXLivePusher();
        this.pusher.setRenderView(container);
        this.pusher.setVideoQuality('720p');
        this.pusher.setAudioQuality('standard');
        this.pusher.setObserver({
            onError: (code, message) => {
                logger.warn('live pusher sdk error', { code });
                this.emitStatus(`推流错误：${code}，${message}`, 'error');
            },
            onWarning: (code, message) => {
                logger.warn('live pusher sdk warning', { code });
                this.emitStatus(`推流警告：${code}，${message}`, 'normal');
            },
            onPushStatusUpdate: (status, message) => {
                this.emitStatus(`推流状态：${status}，${message}`, status === 2 ? 'success' : 'normal');
            },
            onStatisticsUpdate: (statistics) => {
                this.dispatchEvent(new CustomEvent('live-pusher-statistics', {
                    detail: statistics, bubbles: true, composed: true,
                }));
            },
        });
        this.emitStatus('推流器已准备好', 'success');
        return true;
    }

    private static loadScript(): Promise<void> {
        if (window.TXLivePusher) return Promise.resolve();
        if (LivePusherComponent.scriptPromise) return LivePusherComponent.scriptPromise;
        LivePusherComponent.scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = txLivePusherUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('TXLivePusher SDK load failed'));
            document.head.append(script);
        });
        return LivePusherComponent.scriptPromise;
    }

    private emitStatus(message: string, type: LivePusherStatus['type']): void {
        this.dispatchEvent(new CustomEvent<LivePusherStatus>('live-pusher-status', {
            detail: { message, type }, bubbles: true, composed: true,
        }));
    }

    private errorMessage(error: unknown, fallback: string): string {
        return error instanceof Error && error.message ? error.message : fallback;
    }

    private errorType(error: unknown): string {
        return error instanceof Error ? error.name : typeof error;
    }

    private render(): void {
        this.innerHTML = '<div class="live-pusher-preview" data-pusher-preview><span>本地预览</span></div>';
    }
}

if (!customElements.get('live-pusher')) {
    customElements.define('live-pusher', LivePusherComponent);
}
