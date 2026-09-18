import { describe, expect, it, vi } from "vitest";
import EventSystems from "../../assets/gameframex/event/EventSystems";

/**
 * EventPool 契约:订阅/派发/退订;同一 (eventId, handler) 不重复订阅;
 * handler 抛错不影响其他 handler 与派发方。
 */
describe("EventSystems(自研 EventPool)", () => {
    it("on 后 emit 触发回调并携带 payload", () => {
        const pool = new EventSystems();
        const received: unknown[] = [];
        pool.on("evt", (data) => received.push(data));
        pool.emit("evt", 42);
        expect(received).toEqual([42]);
    });

    it("off 后不再触发", () => {
        const pool = new EventSystems();
        const fn = vi.fn();
        pool.on("evt", fn);
        pool.off("evt", fn);
        pool.emit("evt", null);
        expect(fn).not.toHaveBeenCalled();
    });

    it("同一 handler 重复 on 只生效一次", () => {
        const pool = new EventSystems();
        const fn = vi.fn();
        pool.on("evt", fn);
        pool.on("evt", fn);
        pool.emit("evt", null);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("一个 handler 抛错不影响后续 handler", () => {
        const pool = new EventSystems();
        const good = vi.fn();
        pool.on("evt", () => {
            throw new Error("boom");
        });
        pool.on("evt", good);
        expect(() => pool.emit("evt", null)).not.toThrow();
        expect(good).toHaveBeenCalledTimes(1);
    });

    it("offAll 清空指定事件全部订阅", () => {
        const pool = new EventSystems();
        const a = vi.fn();
        const b = vi.fn();
        pool.on("evt", a);
        pool.on("evt", b);
        pool.offAll("evt");
        pool.emit("evt", null);
        expect(a).not.toHaveBeenCalled();
        expect(b).not.toHaveBeenCalled();
    });

    it("once 订阅触发一次后自动退订", () => {
        const pool = new EventSystems();
        const fn = vi.fn();
        pool.once("evt", fn);
        pool.emit("evt", 1);
        pool.emit("evt", 2);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
