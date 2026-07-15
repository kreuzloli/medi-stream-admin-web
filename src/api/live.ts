import { sessionStore } from '../auth/session';
import { logger } from '../common/logger';
import { navigate } from '../router/routes';
import type {
    Department,
    Disease,
    FileObject,
    LiveRoom,
    LiveRoomDetail,
    LiveUrls,
    PageResponse,
} from '../types';
import { ApiError, requestJson } from './http';

type QueryValue = string | number | undefined;

function queryString(values: Record<string, QueryValue>): string {
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const result = query.toString();
    return result ? `?${result}` : '';
}

/** 调用直播管理 API；日志不记录 Token、地址签名或请求体。 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
        return await requestJson(path, { ...options, token: sessionStore.accessToken });
    } catch (error) {
        logger.warn('live management api request failed', {
            method: options.method ?? 'GET',
            path: path.split('?')[0],
            status: error instanceof ApiError ? error.status : undefined,
        });
        if (error instanceof ApiError && error.status === 401) {
            sessionStore.clear();
            navigate('/login');
        }
        throw error;
    }
}

export interface LiveRoomStreamInput {
    id?: number;
    streamName: string;
    title?: string;
    sortNo?: number;
    isDefault?: number;
    status?: number;
}

export interface LiveRoomInput {
    title: string;
    description?: string;
    coverFileId?: number;
    departmentId?: number;
    diseaseId?: number;
    isTop?: number;
    startTime?: string;
    status?: number;
    streams: LiveRoomStreamInput[];
}

export interface LiveUrlQuery {
    streamName: string;
    ttlSeconds?: number;
    transcodeTemplate?: string;
}

export interface LiveStateQuery {
    AppName: string;
    DomainName: string;
    StreamName: string;
}

export const liveApi = {
    rooms(values: Record<string, QueryValue>): Promise<PageResponse<LiveRoom>> {
        return request(`/live-rooms${queryString(values)}`);
    },
    room(id: number): Promise<LiveRoomDetail> {
        return request(`/live-rooms/${id}`);
    },
    createRoom(input: LiveRoomInput): Promise<LiveRoomDetail> {
        return request('/live-rooms', { method: 'POST', body: JSON.stringify(input) });
    },
    updateRoom(id: number, input: LiveRoomInput): Promise<LiveRoomDetail> {
        return request(`/live-rooms/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    },
    deleteRoom(id: number): Promise<boolean> {
        return request(`/live-rooms/${id}`, { method: 'DELETE' });
    },
    setRoomTop(id: number, value: number): Promise<boolean> {
        return request(`/live-rooms/${id}/top`, { method: 'PUT', body: JSON.stringify({ value }) });
    },
    setRoomStatus(id: number, value: number): Promise<boolean> {
        return request(`/live-rooms/${id}/status`, { method: 'PUT', body: JSON.stringify({ value }) });
    },
    changeRoomOwner(id: number, ownerUserId?: number, ownerAdminId?: number): Promise<boolean> {
        return request(`/live-rooms/${id}/owner`, {
            method: 'PUT',
            body: JSON.stringify({ ownerUserId, ownerAdminId }),
        });
    },
    file(id: number): Promise<FileObject> {
        return request(`/files/${id}`);
    },
    uploadFile(file: File): Promise<FileObject> {
        const body = new FormData();
        body.append('file', file);
        return request('/files/upload', { method: 'POST', body });
    },
    /** 获取科室名称候选项，直播间提交时仍使用对应 ID。 */
    departments(): Promise<Department[]> {
        return request('/departments');
    },
    /** 按科室加载疾病名称，避免跨科室选择错误。 */
    diseases(departmentId: number): Promise<Disease[]> {
        return request(`/diseases${queryString({ deptId: departmentId })}`);
    },
    generateUrls(values: LiveUrlQuery): Promise<LiveUrls> {
        return request(`/tencent-live/urls${queryString({ ...values })}`);
    },
    streamState(values: LiveStateQuery): Promise<{ Response: unknown }> {
        return request('/tencent-live/stream-state', { method: 'POST', body: JSON.stringify(values) });
    },
};
