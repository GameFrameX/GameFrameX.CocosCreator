import { afterEach, describe, expect, it, vi } from "vitest";
import ProtoMessageHelper from "../../assets/gameframex/network/ProtoMessageHelper";
import MessageHandlerRegistry, { MessageHandler } from "../../assets/gameframex/network/MessageHandler";

/** 每个用例后清空全局注册表,保证测试隔离 */
afterEach(() => {
    MessageHandlerRegistry.clear();
    ProtoMessageHelper.reset();
});

describe("MessageHandler 装饰器 + MessageHandlerRegistry", () => {
    it("按消息号注册静态 Handler 并分发", () => {
        const handler = vi.fn();
        @MessageHandler(655371)
        class HeartBeatHandler {
            public static Handler(message: unknown): void {
                handler(message);
            }
        }
        void HeartBeatHandler;
        MessageHandlerRegistry.dispatch(655371, { Timestamp: 123 });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ Timestamp: 123 });
    });

    it("按包全名注册:注册时消息尚未登记,首次分发时延迟解析为消息号", () => {
        const handler = vi.fn();
        @MessageHandler("Basic.NotifyHeartBeat")
        class NamedHandler {
            public static Handler(message: unknown): void {
                handler(message);
            }
        }
        void NamedHandler;
        // 分发一个无关消息号:不抛错、不误触
        expect(() => MessageHandlerRegistry.dispatch(100, null)).not.toThrow();
        expect(handler).not.toHaveBeenCalled();

        // 消息注册后(生成代码 register),按消息号分发命中
        ProtoMessageHelper.registerRespMessage("Basic.NotifyHeartBeat", 655371);
        MessageHandlerRegistry.dispatch(655371, null);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("按包全名注册:装饰时消息已登记,直接按号命中", () => {
        ProtoMessageHelper.registerRespMessage("Basic.NotifyServerFullyLoaded", 655372);
        const handler = vi.fn();
        @MessageHandler("Basic.NotifyServerFullyLoaded")
        class EarlyBoundHandler {
            public static Handler(message: unknown): void {
                handler(message);
            }
        }
        void EarlyBoundHandler;
        MessageHandlerRegistry.dispatch(655372, null);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("同一 handler 重复注册只生效一次", () => {
        const handler = vi.fn();
        @MessageHandler(1001)
        class DupHandler {
            public static Handler(message: unknown): void {
                handler(message);
            }
        }
        MessageHandlerRegistry.register(1001, DupHandler.Handler);
        MessageHandlerRegistry.dispatch(1001, null);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("同一消息号多个 handler 全部按注册顺序分发", () => {
        const calls: string[] = [];
        @MessageHandler(2002)
        class FirstHandler {
            public static Handler(): void {
                calls.push("first");
            }
        }
        @MessageHandler(2002)
        class SecondHandler {
            public static Handler(): void {
                calls.push("second");
            }
        }
        void FirstHandler;
        void SecondHandler;
        MessageHandlerRegistry.dispatch(2002, null);
        expect(calls).toEqual(["first", "second"]);
    });

    it("未注册的消息号分发静默跳过,handler 抛错不中断其余 handler", () => {
        const good = vi.fn();
        @MessageHandler(3003)
        class ThrowingHandler {
            public static Handler(): void {
                throw new Error("boom");
            }
        }
        @MessageHandler(3003)
        class GoodHandler {
            public static Handler(): void {
                good();
            }
        }
        void ThrowingHandler;
        void GoodHandler;
        expect(() => MessageHandlerRegistry.dispatch(3003, null)).not.toThrow();
        expect(good).toHaveBeenCalledTimes(1);
        expect(() => MessageHandlerRegistry.dispatch(999999, null)).not.toThrow();
    });

    it("被装饰类缺少静态 Handler 方法时装饰即抛错", () => {
        expect(() => {
            @MessageHandler(4004)
            class MissingHandler {
                public static Other(message: unknown): void {
                    void message;
                }
            }
            void MissingHandler;
        }).toThrow(/Handler/);
    });

    it("clear 后不再分发", () => {
        const handler = vi.fn();
        @MessageHandler(5005)
        class TempHandler {
            public static Handler(message: unknown): void {
                handler(message);
            }
        }
        void TempHandler;
        MessageHandlerRegistry.clear();
        MessageHandlerRegistry.dispatch(5005, null);
        expect(handler).not.toHaveBeenCalled();
    });
});
