import { describe, expect, it, vi } from "vitest";
import Log from "../../assets/gameframex/base/Log";
import TimerModule, { TimerTimeScale } from "../../assets/gameframex/timer/TimerModule";

/**
 * TimerModule 契约(对照 Unity TimerComponent/TimerManager):
 * - 注册延迟一帧入队(与 Unity _toAdd flush 语义一致):注册后的首次 update 仅完成入队,不累计;
 * - 累计由 update(dt) 注入的帧增量推进;触发后余量 ≤0.03s 滚入下一轮,超过则清零(滞后帧不连发);
 * - repeat=0 表示无限;同一回调可注册多个独立 id;shutdown 全清且不触发任何回调。
 */

/** 注册帧:与 Unity 一致,add 后第一次 update 仅完成入队(不累计)。 */
const flush = (m: TimerModule): void => m.update(0);

/** 排空微任务,让已 resolve 的 Promise 链落地。 */
const tick = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe("TimerModule(计时器模块)", () => {
    it("addOnce 到时触发一次后自动移除", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id = m.addOnce(1, cb);
        expect(id).toBeGreaterThan(0);
        expect(m.exists(id)).toBe(true);
        flush(m);
        m.update(0.5);
        expect(cb).not.toHaveBeenCalled();
        m.update(0.5);
        expect(cb).toHaveBeenCalledTimes(1);
        m.update(5);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(m.exists(id)).toBe(false);
    });

    it("add 循环定时器按周期触发 N 次后自动移除", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id = m.add(1, 3, cb);
        flush(m);
        expect(m.getRepeatLeft(id)).toBe(3);
        m.update(1);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(m.getRepeatLeft(id)).toBe(2);
        m.update(1);
        m.update(1);
        expect(cb).toHaveBeenCalledTimes(3);
        expect(m.exists(id)).toBe(false);
        expect(m.getRepeatLeft(id)).toBe(-1);
        m.update(1);
        expect(cb).toHaveBeenCalledTimes(3);
    });

    it("滞后帧余量超过 0.03s 被截断,不连发", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        m.add(0.6, 0, cb);
        flush(m);
        m.update(1.0);
        expect(cb).toHaveBeenCalledTimes(1);
        m.update(0.2);
        expect(cb).toHaveBeenCalledTimes(1);
        m.update(0.4);
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it("小于 0.03s 的帧余量保留累计(防帧步长漂移)", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        m.add(0.2, 0, cb);
        flush(m);
        m.update(0.21);
        expect(cb).toHaveBeenCalledTimes(1);
        m.update(0.2);
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it("remove(id) 后不再触发", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id = m.add(1, 0, cb);
        flush(m);
        m.update(0.5);
        m.remove(id);
        expect(m.exists(id)).toBe(false);
        m.update(0.5);
        m.update(5);
        expect(cb).not.toHaveBeenCalled();
    });

    it("remove(callback) 移除该回调绑定的全部定时器(未入队)", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        m.addOnce(1, cb);
        m.addOnce(2, cb);
        m.remove(cb);
        m.update(0);
        m.update(5);
        expect(cb).not.toHaveBeenCalled();
    });

    it("remove(callback) 对已入队定时器同样生效", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        m.addOnce(1, cb);
        m.addOnce(2, cb);
        flush(m);
        m.remove(cb);
        m.update(5);
        expect(cb).not.toHaveBeenCalled();
    });

    it("callbackParam(userData)原样透传给回调", () => {
        const m = new TimerModule();
        const data = { hp: 100 };
        let received: unknown = null;
        m.addOnce(0.1, (param) => {
            received = param;
        }, data);
        flush(m);
        m.update(0.1);
        expect(received).toBe(data);
    });

    it("update(dt) 逐帧推进累计,getElapsed/getRemaining 反映进度", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id = m.addOnce(1, cb);
        expect(m.getElapsed(id)).toBe(-1);
        flush(m);
        expect(m.getElapsed(id)).toBe(0);
        m.update(0.3);
        expect(m.getElapsed(id)).toBeCloseTo(0.3);
        expect(m.getRemaining(id)).toBeCloseTo(0.7);
        m.update(0.3);
        expect(cb).not.toHaveBeenCalled();
        m.update(0.4);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(m.getElapsed(id)).toBe(-1);
    });

    it("shutdown 清理全部定时器与标签,之后可重新使用", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id1 = m.addOnce(1, cb);
        m.add(1, 0, cb, undefined, "fx");
        flush(m);
        m.update(0.5);
        m.shutdown();
        m.update(10);
        expect(cb).not.toHaveBeenCalled();
        expect(m.exists(id1)).toBe(false);
        expect(m.hasTag("fx")).toBe(false);

        const cb2 = vi.fn();
        const id2 = m.addOnce(0.1, cb2);
        expect(id2).toBeGreaterThan(id1);
        flush(m);
        m.update(0.1);
        expect(cb2).toHaveBeenCalledTimes(1);
    });

    it("同一回调可注册多个独立 id,互不影响", () => {
        const m = new TimerModule();
        const shared = vi.fn();
        const id1 = m.addOnce(1, shared);
        const id2 = m.addOnce(2, shared);
        expect(id1).not.toBe(id2);
        flush(m);
        m.update(1);
        expect(shared).toHaveBeenCalledTimes(1);
        m.remove(id2);
        expect(m.exists(id2)).toBe(false);
        m.update(1);
        expect(shared).toHaveBeenCalledTimes(1);
    });

    it("addUpdate 每帧触发一次并携带 callbackParam", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const param = { n: 1 };
        m.addUpdate(cb, param);
        m.update(0);
        expect(cb).not.toHaveBeenCalled();
        m.update(0);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenNthCalledWith(1, param);
        const bare = vi.fn();
        m.addUpdate(bare);
        m.update(0);
        m.update(0);
        expect(cb).toHaveBeenCalledTimes(3);
        expect(bare).toHaveBeenCalledTimes(1);
        expect(bare).toHaveBeenNthCalledWith(1, undefined);
    });

    it("onComplete 在自然完成(同帧)、活跃移除(下一帧)与未入队移除(立即)时触发", () => {
        const m = new TimerModule();
        const done1 = vi.fn();
        m.add(0.5, 1, () => {}, undefined, undefined, undefined, done1);
        flush(m);
        m.update(0.5);
        expect(done1).toHaveBeenCalledTimes(1);

        const done2 = vi.fn();
        const id2 = m.add(1, 0, () => {}, undefined, undefined, undefined, done2);
        flush(m);
        m.remove(id2);
        expect(done2).not.toHaveBeenCalled();
        m.update(0);
        expect(done2).toHaveBeenCalledTimes(1);

        const done3 = vi.fn();
        const id3 = m.add(1, 1, () => {}, undefined, undefined, undefined, done3);
        m.remove(id3);
        expect(done3).toHaveBeenCalledTimes(1);
        m.update(5);
        expect(done3).toHaveBeenCalledTimes(1);
    });

    it("pause 期间不累计,resume 后从暂停处继续", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const id = m.addOnce(1, cb);
        flush(m);
        m.update(0.4);
        m.pause(id);
        expect(m.isPaused(id)).toBe(true);
        m.update(0.9);
        expect(cb).not.toHaveBeenCalled();
        expect(m.getElapsed(id)).toBeCloseTo(0.4);
        m.resume(id);
        expect(m.isPaused(id)).toBe(false);
        m.update(0.6);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("标签分组:pauseByTag/resumeByTag/removeByTag/hasTag", () => {
        const m = new TimerModule();
        const cb = vi.fn();
        const a1 = m.add(1, 1, cb, undefined, "fx");
        const a2 = m.add(1, 0, cb, undefined, "fx");
        const b1 = m.add(1, 1, cb, undefined, "ui");
        flush(m);
        expect(m.hasTag("fx")).toBe(true);
        expect(m.hasTag("none")).toBe(false);
        m.pauseByTag("fx");
        expect(m.isPaused(a1)).toBe(true);
        expect(m.isPaused(a2)).toBe(true);
        expect(m.isPaused(b1)).toBe(false);
        m.resumeByTag("fx");
        expect(m.isPaused(a1)).toBe(false);
        m.removeByTag("fx");
        expect(m.hasTag("fx")).toBe(true);
        m.update(0);
        expect(m.hasTag("fx")).toBe(false);
        m.update(5);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("Scaled 定时器按 timeScale 缩放累计,Unscaled 不受影响", () => {
        const m = new TimerModule();
        m.timeScale = 2;
        const scaled = vi.fn();
        const unscaled = vi.fn();
        m.add(2, 1, scaled, undefined, undefined, TimerTimeScale.Scaled);
        m.add(2, 1, unscaled, undefined, undefined, TimerTimeScale.Unscaled);
        flush(m);
        m.update(1);
        expect(scaled).toHaveBeenCalledTimes(1);
        expect(unscaled).not.toHaveBeenCalled();
        m.update(1);
        expect(unscaled).toHaveBeenCalledTimes(1);
    });

    it("不存在或未入队的 id 查询返回 -1;无限循环 remaining 为 0(Unity 语义)", () => {
        const m = new TimerModule();
        expect(m.getRemaining(999)).toBe(-1);
        expect(m.getElapsed(999)).toBe(-1);
        expect(m.getRepeatLeft(999)).toBe(-1);
        const id = m.add(1, 0, () => {});
        expect(m.getRemaining(id)).toBe(-1);
        flush(m);
        expect(m.getRemaining(id)).toBe(0);
        expect(m.getRepeatLeft(id)).toBe(0);
        expect(m.getElapsed(id)).toBe(0);
    });

    it("callback 为空时返回 0 且不注册", () => {
        const m = new TimerModule();
        const empty = null as unknown as () => void;
        expect(m.add(1, 0, empty)).toBe(0);
        flush(m);
        m.update(5);
    });

    it("回调执行期间新增的定时器下一帧安全生效", () => {
        const m = new TimerModule();
        const inner = vi.fn();
        const outer = vi.fn(() => {
            m.addOnce(1, inner);
        });
        m.addOnce(1, outer);
        flush(m);
        m.update(1);
        expect(outer).toHaveBeenCalledTimes(1);
        expect(inner).not.toHaveBeenCalled();
        m.update(0);
        m.update(1);
        expect(inner).toHaveBeenCalledTimes(1);
    });

    it("catchCallbackExceptions 开启时回调异常被吞并告警,不中断其余回调", () => {
        const m = new TimerModule();
        m.catchCallbackExceptions = true;
        const warnSpy = vi.spyOn(Log, "warn").mockImplementation(() => {});
        const good = vi.fn();
        m.addOnce(0.1, () => {
            throw new Error("boom");
        });
        m.addOnce(0.1, good);
        flush(m);
        expect(() => m.update(0.1)).not.toThrow();
        expect(good).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("waitForSecondsAsync 由 update 推进触发", async () => {
        const m = new TimerModule();
        let done = false;
        const p = m.waitForSecondsAsync(1).then(() => {
            done = true;
        });
        flush(m);
        m.update(0.5);
        await tick();
        expect(done).toBe(false);
        m.update(0.5);
        await p;
        expect(done).toBe(true);
    });

    it("waitForFramesAsync 等满指定帧数后完成", async () => {
        const m = new TimerModule();
        let done = false;
        const p = m.waitForFramesAsync(3).then(() => {
            done = true;
        });
        m.update(0);
        await tick();
        expect(done).toBe(false);
        m.update(0);
        await tick();
        expect(done).toBe(false);
        m.update(0);
        await tick();
        expect(done).toBe(false);
        m.update(0);
        await tick();
        expect(done).toBe(true);
        await p;
        await expect(m.waitForFramesAsync(0)).resolves.toBeUndefined();
    });

    it("waitForSecondsAsync 中止信号触发后拒绝", async () => {
        const m = new TimerModule();
        const controller = new AbortController();
        const p = m.waitForSecondsAsync(1, controller.signal);
        controller.abort();
        await expect(p).rejects.toThrow();
        m.update(0);
        m.update(1);
    });
});
