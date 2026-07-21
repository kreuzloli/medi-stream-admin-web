/** `/auth/me` 返回的当前管理员会话信息。 */
export interface AdminSession {
    adminId: number;
    username: string;
    roles: string[];
    permissions: string[];
}

/** `/auth/login` 返回的短期访问凭证。 */
export interface LoginResponse {
    token: string;
}

export interface PageResponse<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface Administrator {
    id: number;
    username: string;
    realName: string;
    lastLoginAt?: string | null;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface Role {
    id: number;
    roleCode: string;
    roleName: string;
    description?: string | null;
    status: number;
}

export interface Permission {
    id: number;
    permissionCode: string;
    permissionName: string;
    resourceType?: string | null;
    description?: string | null;
    status: number;
}

export interface UserInfo {
    id: number;
    userCode?: string | null;
    realName: string;
    nickname?: string | null;
    mobile?: string | null;
    headerId?: number | null;
    hospitalId?: number | null;
    deptId?: number | null;
    hospitalName?: string | null;
    deptName?: string | null;
    identityType?: string | null;
    doctorCertNo?: string | null;
    idCardNo?: string | null;
    doctorCertFileId?: number | null;
    idCardFrontFileId?: number | null;
    idCardBackFileId?: number | null;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface IdsResponse {
    ids: number[];
}

export interface FileObject {
    id: number;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    fileSize?: number | null;
    sha256?: string | null;
    createdAt?: string | null;
}

export interface Department {
    id: number;
    deptName: string;
    deptCode?: string | null;
    sortNo: number;
    status: number;
}

export interface Disease {
    id: number;
    deptId: number;
    diseaseName: string;
    diseaseCode?: string | null;
    keywords?: string | null;
    sortNo: number;
    status: number;
}

export interface LiveRoom {
    id: number;
    ownerUserId?: number | null;
    ownerAdminId?: number | null;
    roomCode: string;
    title: string;
    description?: string | null;
    coverFileId?: number | null;
    departmentId?: number | null;
    diseaseId?: number | null;
    isTop: number;
    startTime?: string | null;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface LiveRoomStream {
    id: number;
    roomId: number;
    streamCode: string;
    streamName: string;
    title?: string | null;
    sortNo: number;
    isDefault: number;
    status: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface LiveRoomDetail extends LiveRoom {
    streams: LiveRoomStream[];
}

export interface LiveUrls {
    streamName: string;
    expireAtEpochSeconds: number;
    txTimeHex: string;
    pushWebrtc: string;
    pushRtmp: string;
    playWebrtc: string;
    playRtmp: string;
    playFlv: string;
    playHls: string;
    transcodeTemplate?: string | null;
    playFlvTranscoded?: string | null;
    playHlsTranscoded?: string | null;
}

/** 可供主播生成直播地址的安全配置，不包含任何腾讯云密钥。 */
export interface TencentLiveConfigOption {
    id: number;
    name: string;
    appName: string;
    pushDomain: string;
    playDomain: string;
    defaultTtlSeconds: number;
}

/** 一次房间 URL 生成结果中的单路直播流。 */
export interface GeneratedLiveStreamUrls extends LiveUrls {
    streamId: number;
    streamCode: string;
    title?: string | null;
    isDefault: boolean;
}

/** 后端按一个配置为房间内全部启用流生成的完整 URL 集合。 */
export interface GeneratedLiveRoomUrls {
    roomId: number;
    liveConfigId: number;
    appName: string;
    pushDomain: string;
    playDomain: string;
    expireAtEpochSeconds: number;
    streams: GeneratedLiveStreamUrls[];
}

/** 已部署的运行信息响应；isLive 是后端结合活动链路和腾讯云状态得出的最终结果。 */
export interface LiveRoomRuntime extends GeneratedLiveRoomUrls {
    activeStreamId: number | null;
    createdAtEpochSeconds?: number;
    streamState: string | null;
    isLive: boolean;
}

/** 设置或清除活动链路后的服务端确认结果。 */
export interface SetActiveStreamResponse {
    roomId: number;
    activeStreamId: number | null;
}
