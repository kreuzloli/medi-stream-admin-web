const API_PREFIX = '/admin/api';

interface RequestOptions extends RequestInit {
    token?: string;
}

interface ErrorBody {
    message?: string;
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * 向管理端 API 发送请求并统一处理 JSON、鉴权头、网络异常和后端错误消息。
 * 路径参数使用 Rust 服务的真实路由，例如 `/auth/me`；本方法负责补充网关前缀。
 */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { token, headers: inputHeaders, ...requestOptions } = options;
    const headers = new Headers(inputHeaders);
    headers.set('Accept', 'application/json');
    if (requestOptions.body) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
        response = await fetch(`${API_PREFIX}${path}`, { ...requestOptions, headers });
    } catch (cause) {
        throw new ApiError(0, cause instanceof Error ? cause.message : '网络连接失败');
    }

    // 错误响应不一定是 JSON，例如网关可能直接返回文本或 HTML。
    const contentType = response.headers.get('Content-Type') ?? '';
    const data = contentType.includes('application/json')
        ? await response.json() as unknown
        : await response.text();

    if (!response.ok) {
        const message = typeof data === 'object' && data !== null
            ? (data as ErrorBody).message
            : undefined;
        throw new ApiError(response.status, message || `请求失败（${response.status}）`);
    }

    return data as T;
}
