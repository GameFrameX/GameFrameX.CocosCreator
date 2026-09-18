/**
 * 网络连接状态机(与 LayaBox 版同契约)。
 *
 * 状态迁移:DISCONNECT → CONNECTING → CHECKING → COMMUNICATION →(关闭/异常)→ DISCONNECT。
 */
export enum NetworkSatus {
    /**
     * 连接中
     */
    STATUS_CONNECTING = 1,
    /**
     * 检验中
     */
    STATUS_CHECKING = 2,
    /**
     * 连接生效
     */
    STATUS_COMMUNICATION = 3,
    /**
     * 关闭连接
     */
    STATUS_DISCONNECT = 4,
}
