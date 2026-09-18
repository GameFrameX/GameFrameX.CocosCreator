import UtilityIdGenerator from "../utility/UtilityIdGenerator";

/**
 * 网络消息基类(与 LayaBox 版同契约)。
 *
 * 契约:构造时由 UtilityIdGenerator 分配进程唯一 UniqueId;
 * MessageId 为 `(module<<16)+id` 消息号,由生成代码/注册表赋值。
 * UniqueId 用于 RPC 请求-响应配对,外部不得修改。
 */
export default class MessageObject {
    /**
     * 唯一标识,请不要外部修改
     */
    public UniqueId: number = 0;

    /**
     * 消息ID(module<<16+id).请不要外部修改.
     */
    public MessageId: number = 0;

    public PackageName: string = "";

    constructor() {
        this.UniqueId = UtilityIdGenerator.getUniqueIntId();
    }
}
