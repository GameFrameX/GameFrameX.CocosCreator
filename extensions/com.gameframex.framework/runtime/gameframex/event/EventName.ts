/**
 * 全局事件名常量(与 Unity 版事件名对齐;引擎无关)。
 *
 * 契约:事件名即字符串,EventPool 按 `(eventId, eventSource)` 订阅/派发;
 * 新增事件必须在此登记,禁止业务层裸写字符串。
 */
export default class EventName {
    /** WebSocket 连接建立 */
    public static readonly SocketConnected = "SocketConnected";
    /** WebSocket 连接关闭 */
    public static readonly SocketClose = "SocketClose";
    /** WebSocket 连接错误 */
    public static readonly SocketError = "SocketError";
    /** WebSocket 重连成功/发起重连 */
    public static readonly SocketReconnect = "SocketReconnect";
    /** 心跳丢失(超过阈值未收到 NotifyHeartBeat) */
    public static readonly NetworkMissHeartBeat = "NetworkMissHeartBeat";
    /** Patch 六步进度(载荷 { stage, progress }) */
    public static readonly PatchProgress = "PatchProgress";
}
