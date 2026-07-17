/** 读取腾讯云 DescribeLiveStreamState 的状态字段，兼容外层 Response 包装。 */
export function isTencentStreamActive(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    const nested = record.Response ?? record.response;
    if (nested && nested !== value) return isTencentStreamActive(nested);
    const state = record.LiveStreamState ?? record.liveStreamState;
    return typeof state === 'string' && state.toLowerCase() === 'active';
}
