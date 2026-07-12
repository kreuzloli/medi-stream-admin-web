declare module 'tcplayer.js' {
    type TCPlayerOptions = {
        licenseUrl?: string;
        width?: string | number;
        height?: string | number;
        controls?: boolean;
        autoplay?: boolean;
        muted?: boolean;
        preload?: 'auto' | 'metadata' | 'none';
        language?: 'zh-CN' | 'en';
        sources?: Array<{
            src: string;
            type?: string;
        }>;
    };

    type TCPlayerInstance = {
        src: (url: string) => void;
        play: () => void;
        pause: () => void;
        dispose: () => void;
    };

    function TCPlayer(id: string, options: TCPlayerOptions): TCPlayerInstance;

    export default TCPlayer;
}
