import { describe, expect, it } from "vitest";
import GameEntry from "../../assets/gameframex/GameEntry";

/** 测试用模块:记录生命周期调用顺序与 dt */
class FakeModule {
    public readonly calls: string[] = [];
    public lastDt: number = -1;
    async init(): Promise<void> {
        this.calls.push("init");
    }
    update(dt: number): void {
        this.calls.push("update");
        this.lastDt = dt;
    }
    shutdown(): void {
        this.calls.push("shutdown");
    }
}

describe("GameEntry 模块注册表", () => {
    it("registerModule 后 getModule 返回同一实例(按名单例)", () => {
        const mod = new FakeModule();
        GameEntry.registerModule("test-single", mod);
        expect(GameEntry.getModule<FakeModule>("test-single")).toBe(mod);
        GameEntry.unregisterModule("test-single");
    });

    it("getModule 未注册名抛错", () => {
        expect(() => GameEntry.getModule("nope")).toThrow();
    });

    it("registerModule 重复注册同名模块抛错", () => {
        GameEntry.registerModule("test-dup", new FakeModule());
        expect(() => GameEntry.registerModule("test-dup", new FakeModule())).toThrow();
        GameEntry.unregisterModule("test-dup");
    });

    it("initAll 按注册序初始化,updateAll 透传 dt,shutdownAll 逆序关闭", async () => {
        const order: string[] = [];
        const a = new FakeModule();
        const b = new FakeModule();
        const aIdx = a.calls as unknown as string[];
        // 用包装记录跨模块顺序
        const wrap = (name: string, m: FakeModule) => {
            const origInit = m.init.bind(m);
            m.init = async () => {
                order.push(`init:${name}`);
                await origInit();
            };
            const origShutdown = m.shutdown.bind(m);
            m.shutdown = () => {
                order.push(`shutdown:${name}`);
                origShutdown();
            };
            return m;
        };
        GameEntry.registerModule("order-a", wrap("a", a));
        GameEntry.registerModule("order-b", wrap("b", b));

        await GameEntry.initAll();
        GameEntry.updateAll(0.016);
        GameEntry.shutdownAll();

        expect(order).toEqual(["init:a", "init:b", "shutdown:b", "shutdown:a"]);
        expect(a.lastDt).toBe(0.016);
        expect(b.lastDt).toBe(0.016);
        GameEntry.unregisterModule("order-a");
        GameEntry.unregisterModule("order-b");
    });
});
