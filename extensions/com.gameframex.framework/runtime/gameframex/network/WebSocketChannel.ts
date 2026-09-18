import EventSystems from "../event/EventSystems";
import EventName from "../event/EventName";
import Log from "../base/Log";
import { NetworkSatus } from "./NetworkSatus";
import PackageCodec, { DecodedPacket, PackageDecoder } from "./PackageCodec";

/**
 * 通道依赖的最小 socket 形状(标准全局 WebSocket / 微信小游戏 SocketTask 适配器均满足)。
 * 事件以 onXxx 属性挂载;send 只接收二进制帧。
 */
export interface ISocketLike {
    /** 二进制类型,通道要求置为 "arraybuffer" */
    binaryType: string;
    send(data: ArrayBuffer): void;
    close(): void;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
}

/** socket 工厂:按 url 创建连接(测试注入 mock;运行时默认走全局 WebSocket) */
export type SocketFactory = (url: string) => ISocketLike;

/** 通道可选项 */
export interface WebSocketChannelOptions {
    /** socket 工厂;缺省使用全局 WebSocket(微信小游戏可注入适配器) */
    socketFactory?: SocketFactory;
    /** 事件池;缺省使用独立实例 */
    events?: EventSystems;
}

/**
 * WebSocket 网络通道(引擎无关;对照 LayaBox Network 与 Unity NetworkChannelBase 语义)。
 *
 * 契约:
 * - 状态机:DISCONNECT → CONNECTING → COMMUNICATION;断开/出错回 DISCONNECT。
 * - send 未连接时入队,连接建立后按序 flush;主动 close 清空队列。
 * - 意外断开自动重连:间隔 2s、上限 2 次,重连成功后计数归零;
 *   计时由 update(dt) 帧驱动推进,不依赖 setInterval。
 * - 收包经 PackageDecoder 处理粘包/半包,完整帧逐条回调 onPacket。
 * - 事件:SocketConnected / SocketClose / SocketError / SocketReconnect(重连成功,载荷为第几次)。
 */
export default class WebSocketChannel {
    /** 自动重连间隔(秒) */
    private static readonly RECONNECT_INTERVAL_SECONDS = 2;
    /** 单轮断线自动重连上限(次) */
    private static readonly MAX_RECONNECT_COUNT = 2;
    /** 计时比较容差(消除浮点残差,如 2-1.9-0.1 ≈ 8e-18) */
    private static readonly TIMER_EPSILON = 1e-9;

    private readonly _events: EventSystems;
    private readonly _socketFactory: SocketFactory;
    private readonly _decoder: PackageDecoder = new PackageDecoder();
    private readonly _sendQueue: ArrayBuffer[] = [];

    private _socket: ISocketLike | null = null;
    private _host: string = "";
    private _port: number = 0;
    private _status: NetworkSatus = NetworkSatus.STATUS_DISCONNECT;
    private _manualClosed: boolean = false;
    private _reconnectCount: number = 0;
    private _reconnectTimer: number = -1;
    private _socketEventGuard: boolean = false;
    private _reconnectAttempt: number = 0;
    private _socketCloseAnnounced: boolean = false;

    /** 完整帧回调(由 NetworkModule 挂接) */
    public onPacket: ((frame: DecodedPacket) => void) | null = null;

    constructor(options: WebSocketChannelOptions = {}) {
        this._events = options.events ?? new EventSystems();
        this._socketFactory = options.socketFactory ?? WebSocketChannel.createDefaultSocket;
    }

    /**
     * 当前连接状态(NetworkSatus)。
     */
    public get status(): NetworkSatus {
        return this._status;
    }

    /**
     * 是否处于通信状态(可直发)。
     */
    public get isConnected(): boolean {
        return this._status === NetworkSatus.STATUS_COMMUNICATION;
    }

    /**
     * 发起连接;仅在 DISCONNECT 状态生效,重复调用静默忽略。
     */
    public connect(host: string, port: number): void {
        if (this._status !== NetworkSatus.STATUS_DISCONNECT) {
            return;
        }
        this._host = host;
        this._port = port;
        this._manualClosed = false;
        this._reconnectCount = 0;
        this._reconnectAttempt = 0;
        this._socketCloseAnnounced = false;
        this._decoder.clear();
        this._status = NetworkSatus.STATUS_CONNECTING;
        this.openSocket();
    }

    /**
     * 主动关闭:清空发送队列、进入 DISCONNECT,不再自动重连。
     * 已处于 DISCONNECT 时仅派发一次 SocketClose。
     */
    public close(): void {
        if (this._status === NetworkSatus.STATUS_DISCONNECT) {
            if (!this._socketCloseAnnounced) {
                this._socketCloseAnnounced = true;
                this._events.emit(EventName.SocketClose, null);
            }
            return;
        }
        this._manualClosed = true;
        this._reconnectTimer = -1;
        this._sendQueue.length = 0;
        this.teardownSocket();
        this._status = NetworkSatus.STATUS_DISCONNECT;
        this._socketCloseAnnounced = true;
        this._events.emit(EventName.SocketClose, null);
    }

    /**
     * 发送一帧二进制;未进入通信状态时入队,连接建立后按序 flush。
     */
    public send(data: ArrayBuffer): void {
        if (this._status === NetworkSatus.STATUS_COMMUNICATION && this._socket !== null) {
            this._socket.send(data);
            return;
        }
        this._sendQueue.push(data);
    }

    /**
     * 帧驱动:推进自动重连计时(由上层模块每帧调用)。
     */
    public update(dt: number): void {
        if (this._reconnectTimer < 0) {
            return;
        }
        this._reconnectTimer -= dt;
        if (this._reconnectTimer > WebSocketChannel.TIMER_EPSILON) {
            return;
        }
        this._reconnectTimer = -1;
        if (this._reconnectCount >= WebSocketChannel.MAX_RECONNECT_COUNT) {
            Log.warn("WebSocketChannel", `重连已达上限 ${WebSocketChannel.MAX_RECONNECT_COUNT} 次,停止重连`);
            return;
        }
        this._reconnectCount++;
        Log.info("WebSocketChannel", `自动重连第 ${this._reconnectCount} 次: ${this._host}:${this._port}`);
        this._decoder.clear();
        this._status = NetworkSatus.STATUS_CONNECTING;
        this.openSocket();
    }

    /**
     * 默认 socket 工厂:使用运行环境全局 WebSocket(浏览器/微信小游戏适配层)。
     */
    private static createDefaultSocket(url: string): ISocketLike {
        const globalWebSocket = (globalThis as unknown as Record<string, unknown>).WebSocket;
        if (typeof globalWebSocket !== "function") {
            throw new Error("[WebSocketChannel] 当前运行环境没有全局 WebSocket,请注入 socketFactory");
        }
        return new (globalWebSocket as new (url: string) => ISocketLike)(url);
    }

    private openSocket(): void {
        const url = `ws://${this._host}:${this._port}`;
        const socket = this._socketFactory(url);
        this._socketEventGuard = false;
        socket.binaryType = "arraybuffer";
        socket.onopen = (): void => this.handleOpen();
        socket.onclose = (): void => this.handleClose();
        socket.onerror = (): void => this.handleError();
        socket.onmessage = (event): void => this.handleMessage(event);
        this._socket = socket;
    }

    private handleOpen(): void {
        this._status = NetworkSatus.STATUS_COMMUNICATION;
        this._reconnectCount = 0; // 连接成功,本轮断线重连额度恢复
        this._socketCloseAnnounced = false;
        if (this._reconnectAttempt > 0) {
            this._events.emit(EventName.SocketReconnect, this._reconnectAttempt);
            this._reconnectAttempt = 0;
        }
        this._events.emit(EventName.SocketConnected, null);
        this.flushSendQueue();
    }

    private handleClose(): void {
        if (this._socketEventGuard) {
            return;
        }
        this._socketEventGuard = true;
        this.teardownSocket();
        this._status = NetworkSatus.STATUS_DISCONNECT;
        this._socketCloseAnnounced = true;
        this._events.emit(EventName.SocketClose, null);
        this.scheduleReconnect();
    }

    private handleError(): void {
        if (this._socketEventGuard) {
            return;
        }
        this._socketEventGuard = true;
        this.teardownSocket();
        this._status = NetworkSatus.STATUS_DISCONNECT;
        this._events.emit(EventName.SocketError, null);
        this._socketCloseAnnounced = true;
        this._events.emit(EventName.SocketClose, null);
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this._manualClosed) {
            return;
        }
        this._reconnectAttempt = this._reconnectCount + 1;
        this._reconnectTimer = WebSocketChannel.RECONNECT_INTERVAL_SECONDS;
    }

    private teardownSocket(): void {
        if (this._socket === null) {
            return;
        }
        const socket = this._socket;
        this._socket = null;
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
        this._decoder.clear();
    }

    private flushSendQueue(): void {
        while (this._sendQueue.length > 0 && this._status === NetworkSatus.STATUS_COMMUNICATION && this._socket !== null) {
            const data = this._sendQueue.shift();
            if (data === undefined) {
                break;
            }
            this._socket.send(data);
        }
    }

    private handleMessage(event: { data: unknown }): void {
        const data = event.data;
        if (!(data instanceof ArrayBuffer)) {
            Log.warn("WebSocketChannel", "收到非二进制消息,已忽略");
            return;
        }
        this._decoder.push(data);
        for (const frame of this._decoder.drain()) {
            if (this.onPacket !== null) {
                this.onPacket(frame);
            }
        }
    }
}
