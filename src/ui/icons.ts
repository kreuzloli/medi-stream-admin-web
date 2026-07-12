import type { IconName } from '../navigation/navigation';

const paths: Record<IconName | 'menu' | 'logout' | 'calendar' | 'arrow' | 'lock' | 'eye' | 'check', string> = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    hospital: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h6M12 6v6"/>',
    catalog: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    video: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 4-2v8l-4-2z"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.1-9.88A7 7 0 0 1 21 13a6 6 0 0 1-3.5 6Z"/><path d="m10 14 2-2 2 2M12 12v6"/>',
    admin: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    role: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15.4a5 5 0 0 1 7 4.6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
};

/** 返回使用 `currentColor` 的统一线性 SVG 图标。 */
export function icon(name: keyof typeof paths, className = ''): string {
    return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

/** 返回 Medi Stream 品牌波纹标记。 */
export function streamMark(): string {
    return '<svg class="stream-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="M4 12c9-9 18-9 27 0s18 9 29 0"/><path d="M4 24c9-9 18-9 27 0s18 9 29 0"/><path d="M4 36c9-9 18-9 27 0s18 9 29 0"/></svg>';
}
