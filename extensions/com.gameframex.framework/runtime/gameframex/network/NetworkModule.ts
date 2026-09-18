import EventSystems from "../event/EventSystems";
import EventName from "../event/EventName";
import Log from "../base/Log";
import { IModule } from "../GameEntry";
import MessageHandlerRegistry from "./MessageHandler";
import MessageObject from "./MessageObject";
import PackageCodec, { DecodedPacket } from "./PackageCodec";
import ProtoMessageHelper from "./ProtoMessageHelper";
import IHeartBeatMessage from "./IHeartBeatMessage";
import IRequestMessage from "./IRequestMessage";
import WebSocketChannel from "./WebSocketChannel";

/** Basic.ReqHeartBeat 消息号((10<<16)+10) */
const REQ_HEART_BEAT_MESSAGE_ID = 655370;
/** Basic.NotifyHeartBeat 消息号((10<<16)+11) */
const NOTIFY_HEART_BEAT_MESSAGE_ID = 655371;

/** RPC 未决调用(10s 超时,由 update(dt) 虚拟时钟驱动) */
interface PendingCall {
    messageId: number;
    deadline: number;
    resolve: (message: MessageObject) => void;
    reject: (reason: Error) => void;
}

/** 心跳请求消息(Basic.ReqHeartBeat 的线格式:body 仅含 Timestamp) */
class ReqHeartBeatMessage extends MessageObject implements IRequestMessage, IHeartBeatMessage {
    public readonly PackageName = "Basic.ReqHeartBeat";
    public Timestamp = 0;
}

/** 模块可选项 */
export interface NetworkModuleOptions {
    /** 网络通道;缺省自建(标准全局 WebSocket) */
    channel?: WebSocketChannel;
    /** 事件池;缺省使用独立实例 */
    events?: EventSystems;
    /** 心跳间隔(秒),默认 30(与 Unity DefaultHeartBeatInterval 对齐) */
    heartBeatInterval?: number;
    /** 心跳连续丢失上限,超过后关闭通道,默认 10(与 Unity DefaultMissHeartBeatCountByClose 对齐) */
    missHeartBeatLimit?: number;
    /** RPC 超时(秒),默认 10 */
    rpcTimeoutSeconds?: number;
}

/**
 * 网络模块(IModule):持有 WebSocketChannel,提供 RPC 配对、Notify 分发与心跳。
 *
 * 契约:
 * - call(req):以 req.UniqueId 注册 PendingCall(10s 虚拟时钟超时 reject),
 *   回包按包头 uniqueId(int32 语义)配对 resolve;无匹配 uniqueId 的回包按 Notify
 *   经 MessageHandlerRegistry 分发。
 * - send(msg):非 RPC 直发(未连接时随通道队列缓冲)。
 * - 心跳:通信状态下每 30s 发送 Basic.ReqHeartBeat(operationType=1);
 *   每跳检查上一跳是否收到 NotifyHeartBeat 回应,丢失则派发
 *   EventName.NetworkMissHeartBeat(载荷为连续丢失次数);连续丢失超过上限关闭通道。
 * - 全部计时(RPC 超时/心跳/重连)由 update(dt) 帧驱动,不依赖 setInterval。
 */
export default class NetworkModule implements IModule {
    private readonly _channel: WebSocketChannel;
    private readonly _events: EventSystems;
    private readonly _heartBeatInterval: number;
    private readonly _missHeartBeatLimit: number;
    private readonly _rpcTimeoutSeconds: number;
    private readonly _pendingCalls: Map<number, PendingCall> = new Map();
    private readonly _handleConnected: () => void;
    private readonly _handleClosed: () => void;

    private _virtualTime = 0;
    private _heartBeatElapsed = 0;
    private _missHeartBeatCount = 0;
    private _heartbeatActive = false;

    constructor(options: NetworkModuleOptions = {}) {
        this._events = options.events ?? new EventSystems();
        this._channel = options.channel ?? new WebSocketChannel({ events: this._events });
        this._heartBeatInterval = options.heartBeatInterval ?? 30;
        this._missHeartBeatLimit = options.missHeartBeatLimit ?? 10;
        this._rpcTimeoutSeconds = options.rpcTimeoutSeconds ?? 10;
        this._channel.onPacket = (frame): void => this.handlePacket(frame);
        this._handleConnected = (): void => this.startHeartBeat();
        this._handleClosed = (): void => this.stopHeartBeat();
        this._events.on(EventName.SocketConnected, this._handleConnected);
        this._events.on(EventName.SocketClose, this._handleClosed);
    }

    /**
     * 发起连接(委托通道;未连接期间的 call/send 随通道队列缓冲)。
     */
    public connect(host: string, port: number): void {
        this._channel.connect(host, port);
    }

    /**
     * RPC 调用:按 UniqueId 配对等待回包,10s 虚拟时钟超时 reject。
     */
    public call(req: MessageObject): Promise<MessageObject> {
        const bytes = this.encodeMessage(req);
        const uniqueKey = req.UniqueId | 0; // 线上传输为 int32,配对键与包头一致
        return new Promise<MessageObject>((resolve, reject) => {
            this._pendingCalls.set(uniqueKey, {
                messageId: req.MessageId,
                deadline: this._virtualTime + this._rpcTimeoutSeconds,
                resolve,
                reject,
            });
            this._channel.send(bytes);
        });
    }

    /**
     * 非 RPC 直发(通知/上报方向,不等待回包)。
     */
    public send(msg: MessageObject): void {
        this._channel.send(this.encodeMessage(msg));
    }

    /**
     * IModule.init:预留生命周期入口(通道与事件挂接在构造时完成)。
     */
    public async init(): Promise<void> {
        await Promise.resolve();
    }

    /**
     * IModule.update:帧驱动推进通道重连、RPC 超时与心跳计时。
     */
    public update(dt: number): void {
        this._virtualTime += dt;
        this._channel.update(dt);
        this.checkRpcTimeouts();
        if (this._heartbeatActive && this._channel.isConnected) {
            this._heartBeatElapsed += dt;
            while (this._heartBeatElapsed >= this._heartBeatInterval) {
                this._heartBeatElapsed -= this._heartBeatInterval;
                this.tickHeartBeat();
            }
        }
    }

    /**
     * IModule.shutdown:关闭通道、解绑事件并 reject 全部未决 RPC。
     */
    public shutdown(): void {
        this.stopHeartBeat();
        this._channel.onPacket = null;
        this._events.off(EventName.SocketConnected, this._handleConnected);
        this._events.off(EventName.SocketClose, this._handleClosed);
        for (const pending of this._pendingCalls.values()) {
            pending.reject(new Error("[NetworkModule] 网络模块已关闭,调用中止"));
        }
        this._pendingCalls.clear();
        this._channel.close();
    }

    /** 编码一条出站消息;心跳消息(655370)强制使用 operationType=1,其余 4 */
    private encodeMessage(msg: MessageObject): ArrayBuffer {
        const messageType = ProtoMessageHelper.getMessageType(msg.PackageName);
        const messageId = ProtoMessageHelper.getMessageIdByModule(msg.PackageName);
        msg.MessageId = messageId;
        const body = messageType.encode(messageType.create(msg)).finish();
        const operationType =
            messageId === REQ_HEART_BEAT_MESSAGE_ID
                ? PackageCodec.OPERATION_TYPE_HEART_BEAT
                : PackageCodec.OPERATION_TYPE_GAME;
        const packet = PackageCodec.encode(msg.UniqueId, messageId, body, operationType);
        const buffer = new ArrayBuffer(packet.byteLength);
        new Uint8Array(buffer).set(packet);
        return buffer;
    }

    /** 回包入口:心跳回应重置计数 → uniqueId 配对 resolve → 否则 Notify 分发 */
    private handlePacket(frame: DecodedPacket): void {
        if (frame.zipFlag > 0) {
            Log.warn(
                "NetworkModule",
                `收到压缩消息(messageId=${frame.messageId}, zipFlag=1),客户端暂未实现解压,已跳过`,
            );
            return;
        }
        if (frame.messageId === NOTIFY_HEART_BEAT_MESSAGE_ID) {
            this._missHeartBeatCount = 0; // 心跳回应到达,重置连续丢失计数
        }
        const pending = this._pendingCalls.get(frame.uniqueId);
        try {
            if (pending !== undefined) {
                this._pendingCalls.delete(frame.uniqueId);
                pending.resolve(this.decodeMessage(frame));
                return;
            }
            MessageHandlerRegistry.dispatch(frame.messageId, this.decodeMessage(frame));
        } catch (error) {
            this._pendingCalls.delete(frame.uniqueId); // 解码失败的配对条目作废,避免泄漏
            if (pending !== undefined) {
                pending.reject(new Error(`[NetworkModule] 回包解码失败: messageId=${frame.messageId}`));
            }
            Log.error(
                "NetworkModule",
                `消息处理异常 messageId=${frame.messageId} uniqueId=${frame.uniqueId}`,
                error,
            );
        }
    }

    private decodeMessage(frame: DecodedPacket): MessageObject {
        const messageType = ProtoMessageHelper.getMessageRespTypeByIndex(frame.messageId);
        const decoded = messageType.decode(frame.body);
        const message = new MessageObject();
        if (decoded !== null && typeof decoded === "object") {
            Object.assign(message, decoded);
        }
        message.UniqueId = frame.uniqueId;
        message.MessageId = frame.messageId;
        return message;
    }

    private checkRpcTimeouts(): void {
        for (const [uniqueKey, pending] of Array.from(this._pendingCalls.entries())) {
            if (this._virtualTime < pending.deadline) {
                continue;
            }
            this._pendingCalls.delete(uniqueKey);
            pending.reject(new Error(`[NetworkModule] RPC 超时(${this._rpcTimeoutSeconds}s): messageId=${pending.messageId}`));
        }
    }

    private startHeartBeat(): void {
        this._heartbeatActive = true;
        this._heartBeatElapsed = 0;
        this._missHeartBeatCount = 0;
    }

    private stopHeartBeat(): void {
        this._heartbeatActive = false;
        this._heartBeatElapsed = 0;
    }

    /** 一跳心跳:发送 ReqHeartBeat;若上一跳未收到回应则派发丢失事件;超过上限关闭通道 */
    private tickHeartBeat(): void {
        const heartbeat = new ReqHeartBeatMessage();
        heartbeat.Timestamp = Math.floor(Date.now() / 1000);
        this._channel.send(this.encodeMessage(heartbeat));
        if (this._missHeartBeatCount > 0) {
            this._events.emit(EventName.NetworkMissHeartBeat, this._missHeartBeatCount);
        }
        this._missHeartBeatCount++;
        if (this._missHeartBeatCount > this._missHeartBeatLimit) {
            Log.error(
                "NetworkModule",
                `连续丢失心跳 ${this._missHeartBeatCount - 1} 次(上限 ${this._missHeartBeatLimit}),关闭通道`,
            );
            this._channel.close();
        }
    }
}
