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
    hospitalId?: number | null;
    deptId?: number | null;
    hospitalName?: string | null;
    deptName?: string | null;
    identityType?: string | null;
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
