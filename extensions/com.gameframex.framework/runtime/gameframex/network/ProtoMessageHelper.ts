import IMessage from "./IMessage";

interface MessageClassObjectData {
    /** 消息号(module<<16+id) */
    messageId: number;
    /** 包全名,如 "Basic.ReqHeartBeat" */
    moduleName: string;
    /** req/resp 方向 */
    kind: "req" | "resp";
}

/**
 * 消息注册与类型解析中心(对照 LayaBox 版 ProtoMessageHelper 契约,静态 bundle 化)。
 *
 * 契约:
 * 1. 生成代码在每个消息类的 `register()` 中调用 registerReqMessage/registerRespMessage(PackageName, MessageId)。
 * 2. init(bundleRoot) 注入 pbjs static-module 产物(含 `$root` 命名空间树);getMessageType 按包全名解析出
 *    create/verify/encode/decode 四件套(即 IMessage),供通道层做二进制编解码。
 * 3. 启动自检(R7):registeredCount 必须 === 61,否则启动告警。
 */
export default class ProtoMessageHelper {
    private static _bundleRoot: Record<string, unknown> | null = null;
    private static _typeCache: Map<string, IMessage> = new Map();
    private static _registry: MessageClassObjectData[] = [];
    private static _messageIdByModule: Map<string, number> = new Map();
    private static _moduleByMessageId: Map<number, string> = new Map();

    /**
     * 注入静态 bundle 根命名空间(pbjs static-module 导出的 `$root`)。
     */
    public static init(bundleRoot: Record<string, unknown>): void {
        this._bundleRoot = bundleRoot;
        this._typeCache.clear();
    }

    /**
     * 注册请求消息(由生成代码调用)。
     */
    public static registerReqMessage(moduleName: string, messageId: number): void {
        this.register(moduleName, messageId, "req");
    }

    /**
     * 注册响应/通知消息(由生成代码调用)。
     */
    public static registerRespMessage(moduleName: string, messageId: number): void {
        this.register(moduleName, messageId, "resp");
    }

    private static register(moduleName: string, messageId: number, kind: "req" | "resp"): void {
        if (this._messageIdByModule.has(moduleName)) {
            throw new Error(`[ProtoMessageHelper] 重复注册消息: ${moduleName} (messageId=${messageId})`);
        }
        this._registry.push({ messageId, moduleName, kind });
        this._messageIdByModule.set(moduleName, messageId);
        this._moduleByMessageId.set(messageId, moduleName);
    }

    /**
     * 已注册消息总数(启动自检用,R7:≠61 告警)。
     */
    public static get registeredCount(): number {
        return this._registry.length;
    }

    /**
     * 全部注册项(自检清单工具遍历用)。
     */
    public static get registry(): ReadonlyArray<Readonly<MessageClassObjectData>> {
        return this._registry;
    }

    /**
     * 按包全名取消息号。
     */
    public static getMessageIdByModule(moduleName: string): number {
        const id = this._messageIdByModule.get(moduleName);
        if (id === undefined) {
            throw new Error(`[ProtoMessageHelper] 未注册的消息: ${moduleName}`);
        }
        return id;
    }

    /**
     * 按包全名解析 protobuf Type(create/verify/encode/decode)。
     */
    public static getMessageType(typeName: string): IMessage {
        const cached = this._typeCache.get(typeName);
        if (cached) {
            return cached;
        }
        if (!this._bundleRoot) {
            throw new Error("[ProtoMessageHelper] 尚未 init(bundleRoot),无法解析类型: " + typeName);
        }
        let node: unknown = this._bundleRoot;
        for (const part of typeName.split(".")) {
            if (node === null || typeof node !== "object") {
                throw new Error(`[ProtoMessageHelper] bundle 中不存在命名空间段 "${part}"(解析 ${typeName})`);
            }
            node = (node as Record<string, unknown>)[part];
        }
        // 此处为已知库边界:pbjs static-module 产物 Type 静态方法形状与 IMessage 一致
        const type = node as unknown as IMessage;
        if (typeof type?.create !== "function" || typeof type?.encode !== "function" || typeof type?.decode !== "function") {
            throw new Error(`[ProtoMessageHelper] "${typeName}" 不是合法的消息 Type`);
        }
        this._typeCache.set(typeName, type);
        return type;
    }

    /**
     * 按消息号取响应/通知方向的 protobuf Type(RPC 回包与 Notify 分发解码用)。
     */
    public static getMessageRespTypeByIndex(messageId: number): IMessage {
        return this.getMessageType(this.requireModuleByMessageId(messageId, "resp"));
    }

    /**
     * 按消息号取请求方向的 protobuf Type。
     */
    public static getMessageReqTypeByIndex(messageId: number): IMessage {
        return this.getMessageType(this.requireModuleByMessageId(messageId, "req"));
    }

    private static requireModuleByMessageId(messageId: number, kind: "req" | "resp"): string {
        const moduleName = this._moduleByMessageId.get(messageId);
        if (moduleName === undefined) {
            throw new Error(`[ProtoMessageHelper] 未注册的消息号: ${messageId}`);
        }
        const entry = this._registry.find((item) => item.messageId === messageId);
        if (entry && entry.kind !== kind) {
            throw new Error(`[ProtoMessageHelper] 消息号 ${messageId}(${moduleName})方向为 ${entry.kind},期望 ${kind}`);
        }
        return moduleName;
    }

    /**
     * 测试隔离:清空全部注册与缓存。
     */
    public static reset(): void {
        this._bundleRoot = null;
        this._typeCache.clear();
        this._registry = [];
        this._messageIdByModule.clear();
        this._moduleByMessageId.clear();
    }
}
