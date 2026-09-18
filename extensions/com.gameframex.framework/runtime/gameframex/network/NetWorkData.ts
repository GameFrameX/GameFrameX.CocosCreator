import MessageObject from "./MessageObject";

/**
 * 网络发送队列条目(与 LayaBox 版同契约)。
 *
 * 契约:isRpc=true 的消息进入 RPC PendingCall 配对表等待回包;
 * time 记录入队时间戳,用于发送队列超时诊断。
 */
export default class NetWorkData {
    public _messageObject: MessageObject;
    public time: number = 0;
    private _uniqueId: number = 0;
    private _isRpc: boolean;

    public get messageObject(): MessageObject {
        return this._messageObject;
    }

    public get isRpc(): boolean {
        return this._isRpc;
    }

    public get uniqueId(): number {
        return this._uniqueId;
    }

    public constructor(_uniqueId: number, messageObject: MessageObject, isRpc: boolean = true) {
        this._uniqueId = _uniqueId;
        this._messageObject = messageObject;
        this._isRpc = isRpc;
    }
}
