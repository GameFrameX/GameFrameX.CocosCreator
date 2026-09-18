import Log from "../base/Log";
import ProtoMessageHelper from "./ProtoMessageHelper";

/** 消息处理函数签名(Notify 分发入口) */
export type MessageHandlerFn = (message: unknown) => void;

/**
 * 消息处理器装饰器(对照 Unity MessageHandlerAttribute 语义的 TS 移植)。
 *
 * 用法:被装饰类必须提供 `public static Handler(message: unknown): void` 静态方法;
 * 参数为消息号((module<<16)+id,如 Basic.NotifyHeartBeat=655371)或包全名
 * (如 "Basic.NotifyHeartBeat",在消息注册后延迟解析为消息号)。
 *
 * ```ts
 * @MessageHandler("Basic.NotifyHeartBeat")
 * class HeartBeatHandler {
 *     public static Handler(message: unknown): void { ... }
 * }
 * ```
 */
export function MessageHandler(messageIdOrName: number | string): ClassDecorator {
    return (target: Function): void => {
        const ctor = target as unknown as Record<string, unknown>;
        const handler = ctor["Handler"];
        if (typeof handler !== "function") {
            throw new Error(
                `[MessageHandler] ${String(target.name ?? target)} 缺少静态 Handler(message: unknown) 方法`,
            );
        }
        MessageHandlerRegistry.register(messageIdOrName, handler as MessageHandlerFn);
    };
}

/**
 * 消息处理器注册表:按消息号聚合多个 handler,按注册顺序分发。
 *
 * 契约:单个 handler 抛错被捕获告警,不中断其余 handler;
 * 以包全名注册的 handler 在消息登记后自动解析为消息号(解析失败静默保留,等待后续分发)。
 */
export default class MessageHandlerRegistry {
    private static _handlersByKey: Map<number, MessageHandlerFn[]> = new Map();
    private static _pendingNames: Map<string, MessageHandlerFn[]> = new Map();
    private static _warnedNames: Set<string> = new Set();

    /**
     * 注册处理器;同一 (key, handler) 重复注册只生效一次。
     */
    public static register(messageIdOrName: number | string, handler: MessageHandlerFn): void {
        if (typeof messageIdOrName === "string") {
            const resolved = MessageHandlerRegistry.tryResolveName(messageIdOrName);
            if (resolved !== null) {
                MessageHandlerRegistry.addToMap(resolved, handler);
                return;
            }
            MessageHandlerRegistry.addToPendingMap(messageIdOrName, handler);
            return;
        }
        MessageHandlerRegistry.addToMap(messageIdOrName, handler);
    }

    /**
     * 按消息号分发(Notify 消息入口);未注册的消息号静默跳过。
     */
    public static dispatch(messageId: number, message: unknown): void {
        MessageHandlerRegistry.resolvePendingNames();
        const handlers = MessageHandlerRegistry._handlersByKey.get(messageId);
        if (handlers === undefined) {
            return;
        }
        for (const handler of handlers) {
            try {
                handler(message);
            } catch (error) {
                Log.error("MessageHandlerRegistry", `处理器执行异常 messageId=${messageId}`, error);
            }
        }
    }

    /**
     * 指定消息号的处理器数量(测试与诊断用)。
     */
    public static getHandlerCount(messageId: number): number {
        return MessageHandlerRegistry._handlersByKey.get(messageId)?.length ?? 0;
    }

    /**
     * 清空全部注册(测试隔离用)。
     */
    public static clear(): void {
        MessageHandlerRegistry._handlersByKey.clear();
        MessageHandlerRegistry._pendingNames.clear();
        MessageHandlerRegistry._warnedNames.clear();
    }

    private static addToMap(messageId: number, handler: MessageHandlerFn): void {
        let handlers = MessageHandlerRegistry._handlersByKey.get(messageId);
        if (handlers === undefined) {
            handlers = [];
            MessageHandlerRegistry._handlersByKey.set(messageId, handlers);
        }
        if (!handlers.includes(handler)) {
            handlers.push(handler);
        }
    }

    private static addToPendingMap(name: string, handler: MessageHandlerFn): void {
        let handlers = MessageHandlerRegistry._pendingNames.get(name);
        if (handlers === undefined) {
            handlers = [];
            MessageHandlerRegistry._pendingNames.set(name, handlers);
        }
        if (!handlers.includes(handler)) {
            handlers.push(handler);
        }
    }

    private static tryResolveName(name: string): number | null {
        try {
            return ProtoMessageHelper.getMessageIdByModule(name);
        } catch {
            return null;
        }
    }

    private static resolvePendingNames(): void {
        if (MessageHandlerRegistry._pendingNames.size === 0) {
            return;
        }
        for (const [name, handlers] of Array.from(MessageHandlerRegistry._pendingNames.entries())) {
            const resolved = MessageHandlerRegistry.tryResolveName(name);
            if (resolved === null) {
                if (!MessageHandlerRegistry._warnedNames.has(name)) {
                    MessageHandlerRegistry._warnedNames.add(name);
                    Log.warn("MessageHandlerRegistry", `包名尚未注册到 ProtoMessageHelper,继续等待: ${name}`);
                }
                continue;
            }
            for (const handler of handlers) {
                MessageHandlerRegistry.addToMap(resolved, handler);
            }
            MessageHandlerRegistry._pendingNames.delete(name);
        }
    }
}
