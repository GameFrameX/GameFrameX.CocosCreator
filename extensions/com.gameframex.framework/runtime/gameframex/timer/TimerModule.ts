import type { IModule } from "../GameEntry";
import Log from "../base/Log";

/**
 * 定时器时间缩放模式(对照 Unity TimerTimeScale)。
 */
export enum TimerTimeScale {
    /** 不受模块 timeScale 影响(默认,与 Unity 现有行为兼容)。 */
    Unscaled = 0,
    /** 受模块 timeScale 缩放。 */
    Scaled = 1,
}

/** 定时器回调;参数为注册时透传的 callbackParam(userData)。 */
export type TimerCallback = (param: unknown) => void;

interface TimerItem {
    id: number;
    interval: number;
    repeat: number;
    callback: TimerCallback;
    param: unknown;
    tag: string | null;
    timeScaleMode: TimerTimeScale;
    onComplete: (() => void) | null;
    elapsed: number;
    deleted: boolean;
    isPaused: boolean;
}

/**
 * 计时器模块(引擎无关;对照 Unity com.gameframex.unity.timer 的 TimerComponent/TimerManager)。
 *
 * 契约:
 * - 时间累计完全由 `update(dt)` 注入的帧增量推进(禁 setInterval/setTimeout);dt 视为未缩放的真实增量。
 * - `add` 注册延迟一帧入队(与 Unity 一致):注册后的首次 update 仅完成入队,第二次起开始累计。
 * - 到时按"累计 ≥ interval"触发;触发后余量 ≤0.03s 滚入下一轮,超过则清零(滞后帧不连发)。
 * - `repeat` 为剩余触发次数,0 表示无限;次数耗尽或被移除时触发 `onComplete` 并清理。
 * - 同一回调可注册多个独立 id(与 Unity 的回调去重不同,见迁移 notes);`remove(callback)` 移除该回调绑定的全部定时器。
 * - `shutdown` 清空全部定时器与索引,不触发任何回调;id 单调递增不复用。
 */
export default class TimerModule implements IModule {
    /** Scaled 定时器的累计缩放系数(对照 Unity Time.timeScale;Unscaled 定时器不受影响)。 */
    public timeScale: number = 1;

    /** 开启后回调异常被捕获并告警,不中断 update 与其余回调;默认 false(异常向上抛出)。 */
    public catchCallbackExceptions: boolean = false;

    private readonly _items: Map<number, TimerItem> = new Map<number, TimerItem>();
    private readonly _toAdd: Map<number, TimerItem> = new Map<number, TimerItem>();
    private readonly _toRemove: TimerItem[] = [];
    private readonly _pending: Array<[TimerCallback, unknown]> = [];
    private readonly _tags: Map<string, number[]> = new Map<string, number[]>();
    private _nextId: number = 1;

    /**
     * 模块初始化(计时器无外部资源,空实现满足 IModule 生命周期)。
     */
    public init(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * 添加一个定时调用的任务。
     * @param interval 间隔时间(秒;≤ 0 表示每帧触发)
     * @param repeat 重复次数(0 表示无限重复)
     * @param callback 要执行的回调函数
     * @param callbackParam 回调参数(userData,原样透传,可选)
     * @param tag 标签(用于分组管理,可选)
     * @param timeScale 时间缩放模式(默认 Unscaled)
     * @param onComplete 定时器完成/移除时触发的回调(可选)
     * @returns 定时器唯一 id;callback 为空返回 0
     */
    public add(interval: number, repeat: number, callback: TimerCallback, callbackParam?: unknown, tag?: string, timeScale: TimerTimeScale = TimerTimeScale.Unscaled, onComplete?: () => void): number {
        if (callback == null) {
            Log.warn("Timer", `timer callback is null, ${interval},${repeat}`);
            return 0;
        }

        const id = this._nextId++;
        const item: TimerItem = {
            id,
            interval,
            repeat,
            callback,
            param: callbackParam,
            tag: tag ?? null,
            timeScaleMode: timeScale,
            onComplete: onComplete ?? null,
            elapsed: 0,
            deleted: false,
            isPaused: false,
        };
        this._toAdd.set(id, item);
        this.addToTagIndex(item);
        return id;
    }

    /**
     * 添加一个只执行一次的任务。
     */
    public addOnce(interval: number, callback: TimerCallback, callbackParam?: unknown): number {
        return this.add(interval, 1, callback, callbackParam);
    }

    /**
     * 添加一个每帧更新执行的任务(interval=0 的语法糖)。
     */
    public addUpdate(callback: TimerCallback, callbackParam?: unknown): number {
        return this.add(0, 0, callback, callbackParam);
    }

    /**
     * 检查指定回调是否存在任一定时器(含未入队)。
     */
    public exists(callback: TimerCallback): boolean;
    /**
     * 检查指定 id 的任务是否存在且未被删除(未入队视为存在)。
     */
    public exists(id: number): boolean;
    public exists(target: TimerCallback | number): boolean {
        if (typeof target === "number") {
            const active = this._items.get(target);
            if (active) {
                return !active.deleted;
            }
            return this._toAdd.has(target);
        }

        for (const item of this._toAdd.values()) {
            if (item.callback === target) {
                return true;
            }
        }
        for (const item of this._items.values()) {
            if (item.callback === target && !item.deleted) {
                return true;
            }
        }
        return false;
    }

    /**
     * 移除指定回调绑定的全部定时器;已入队的延迟到下一帧清理并触发 onComplete。
     */
    public remove(callback: TimerCallback): void;
    /**
     * 按 id 移除指定任务;已入队的延迟到下一帧清理并触发 onComplete。
     */
    public remove(id: number): void;
    public remove(target: TimerCallback | number): void {
        if (typeof target === "number") {
            this.removeById(target);
            return;
        }

        for (const item of Array.from(this._toAdd.values())) {
            if (item.callback === target) {
                this.retirePending(item);
            }
        }
        for (const item of this._items.values()) {
            if (item.callback === target && !item.deleted) {
                item.deleted = true;
            }
        }
    }

    /**
     * 暂停指定 id 的定时器(暂停期间不累计;未入队的定时器不支持暂停)。
     */
    public pause(id: number): void {
        if (this._toAdd.has(id)) {
            return;
        }
        const item = this._items.get(id);
        if (item && !item.deleted) {
            item.isPaused = true;
        }
    }

    /**
     * 恢复指定 id 的定时器(从暂停处继续累计)。
     */
    public resume(id: number): void {
        if (this._toAdd.has(id)) {
            return;
        }
        const item = this._items.get(id);
        if (item) {
            item.isPaused = false;
        }
    }

    /**
     * 检查指定 id 的定时器是否处于暂停状态。
     */
    public isPaused(id: number): boolean {
        const item = this._items.get(id);
        return item !== undefined && !item.deleted && item.isPaused;
    }

    /**
     * 暂停指定标签的所有(已入队)定时器。
     */
    public pauseByTag(tag: string): void {
        const ids = this._tags.get(tag);
        if (!ids) {
            return;
        }
        for (const id of ids) {
            const item = this._items.get(id);
            if (item && !item.deleted) {
                item.isPaused = true;
            }
        }
    }

    /**
     * 恢复指定标签的所有(已入队)定时器。
     */
    public resumeByTag(tag: string): void {
        const ids = this._tags.get(tag);
        if (!ids) {
            return;
        }
        for (const id of ids) {
            const item = this._items.get(id);
            if (item) {
                item.isPaused = false;
            }
        }
    }

    /**
     * 移除指定标签的所有定时器(含未入队)。
     */
    public removeByTag(tag: string): void {
        const ids = this._tags.get(tag);
        if (!ids) {
            return;
        }
        for (const id of Array.from(ids)) {
            this.removeById(id);
        }
    }

    /**
     * 检查指定标签是否有定时器(以标签索引为准,与 Unity 一致)。
     */
    public hasTag(tag: string): boolean {
        return (this._tags.get(tag)?.length ?? 0) > 0;
    }

    /**
     * 获取指定 id 定时器的剩余时间(秒);每帧定时器与无限循环固定返回 0;不存在/未入队返回 -1。
     */
    public getRemaining(id: number): number {
        const item = this._items.get(id);
        if (!item || item.deleted) {
            return -1;
        }
        if (item.interval <= 0 || item.repeat === 0) {
            return 0;
        }
        const remaining = item.interval - item.elapsed;
        return remaining > 0 ? remaining : 0;
    }

    /**
     * 获取指定 id 定时器已累计的经过时间(秒);不存在/未入队返回 -1。
     */
    public getElapsed(id: number): number {
        const item = this._items.get(id);
        if (!item || item.deleted) {
            return -1;
        }
        return item.elapsed;
    }

    /**
     * 获取指定 id 定时器的剩余重复次数(0 表示无限);不存在/未入队返回 -1。
     */
    public getRepeatLeft(id: number): number {
        const item = this._items.get(id);
        if (!item || item.deleted) {
            return -1;
        }
        return item.repeat;
    }

    /**
     * 帧驱动:推进全部已入队定时器(由 GameEntry.updateAll 调用;dt 为未缩放真实增量)。
     * 处理顺序与 Unity 一致:累计与触发收集 → 移除处理(触发 onComplete)→ 入队 flush → 执行回调。
     */
    public update(dt: number): void {
        if (this._items.size > 0) {
            for (const item of this._items.values()) {
                if (item.deleted) {
                    this._toRemove.push(item);
                    continue;
                }

                if (item.isPaused) {
                    continue;
                }

                const delta = item.timeScaleMode === TimerTimeScale.Scaled ? dt * this.timeScale : dt;

                // 每帧定时器(interval ≤ 0):不累计,当帧必触发
                if (item.interval <= 0) {
                    this.trigger(item);
                    continue;
                }

                item.elapsed += delta;
                if (item.elapsed < item.interval) {
                    continue;
                }

                item.elapsed -= item.interval;
                if (item.elapsed < 0 || item.elapsed > 0.03) {
                    item.elapsed = 0;
                }

                this.trigger(item);
            }
        }

        if (this._toRemove.length > 0) {
            for (const item of this._toRemove) {
                if (item.deleted) {
                    item.onComplete?.();
                    this._items.delete(item.id);
                    this.removeFromTagIndex(item);
                }
            }
            this._toRemove.length = 0;
        }

        if (this._toAdd.size > 0) {
            for (const item of this._toAdd.values()) {
                this._items.set(item.id, item);
            }
            this._toAdd.clear();
        }

        if (this._pending.length > 0) {
            try {
                for (const [callback, param] of this._pending) {
                    if (this.catchCallbackExceptions) {
                        try {
                            callback(param);
                        } catch (e) {
                            Log.warn("Timer", `Timer callback error > ${e instanceof Error ? e.message : String(e)}`);
                        }
                    } else {
                        callback(param);
                    }
                }
            } finally {
                this._pending.length = 0;
            }
        }
    }

    /**
     * 关闭模块:清空全部定时器、待入队与标签索引,不触发任何回调。
     */
    public shutdown(): void {
        this._toRemove.length = 0;
        this._toAdd.clear();
        this._items.clear();
        this._tags.clear();
        this._pending.length = 0;
    }

    /**
     * 等待指定的秒数后完成(由 update 推进;AbortSignal 对应 Unity CancellationToken,中止时拒绝)。
     */
    public waitForSecondsAsync(seconds: number, signal?: AbortSignal): Promise<void> {
        return this.waitUntil((finish) => this.addOnce(seconds, finish), signal);
    }

    /**
     * 等待下一帧更新后完成。
     */
    public waitForNextFrameAsync(signal?: AbortSignal): Promise<void> {
        return this.waitUntil((finish) => this.addOnce(0, finish), signal);
    }

    /**
     * 等待指定的帧数后完成(frameCount ≤ 0 立即完成;在第 frameCount 次触发时完成)。
     */
    public waitForFramesAsync(frameCount: number, signal?: AbortSignal): Promise<void> {
        if (frameCount <= 0) {
            return Promise.resolve();
        }
        return this.waitUntil((finish) => {
            let fired = 0;
            this.add(0, frameCount, () => {
                fired++;
                if (fired >= frameCount) {
                    finish();
                }
            });
        }, signal);
    }

    /**
     * 记录一次触发:扣减剩余次数,耗尽则标记删除;回调延迟到帧末统一执行(避免遍历时重入)。
     */
    private trigger(item: TimerItem): void {
        if (item.repeat > 0) {
            item.repeat--;
            if (item.repeat === 0) {
                item.deleted = true;
                this._toRemove.push(item);
            }
        }
        this._pending.push([item.callback, item.param]);
    }

    /**
     * 统一的等待实现:注册定时器完成等待;中止信号触发时以拒绝收尾(Promise 单次落定,后到的完成静默忽略)。
     */
    private waitUntil(register: (finish: () => void) => void, signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) {
            return Promise.reject(signal.reason);
        }

        return new Promise<void>((resolve, reject) => {
            const onAbort = (): void => reject(signal?.reason);
            const finish = (): void => {
                if (signal) {
                    signal.removeEventListener("abort", onAbort);
                }
                resolve();
            };
            if (signal) {
                signal.addEventListener("abort", onAbort, { once: true });
            }
            register(finish);
        });
    }

    private removeById(id: number): void {
        const pending = this._toAdd.get(id);
        if (pending) {
            this.retirePending(pending);
            return;
        }
        const item = this._items.get(id);
        if (item) {
            item.deleted = true;
        }
    }

    /**
     * 立即退场未入队定时器:摘除索引并同步触发 onComplete(与 Unity 对 _toAdd 的移除路径一致)。
     */
    private retirePending(item: TimerItem): void {
        this._toAdd.delete(item.id);
        this.removeFromTagIndex(item);
        item.onComplete?.();
    }

    private addToTagIndex(item: TimerItem): void {
        if (item.tag === null) {
            return;
        }
        const ids = this._tags.get(item.tag);
        if (ids) {
            ids.push(item.id);
        } else {
            this._tags.set(item.tag, [item.id]);
        }
    }

    private removeFromTagIndex(item: TimerItem): void {
        if (item.tag === null) {
            return;
        }
        const ids = this._tags.get(item.tag);
        if (!ids) {
            return;
        }
        const index = ids.indexOf(item.id);
        if (index >= 0) {
            ids.splice(index, 1);
        }
        if (ids.length === 0) {
            this._tags.delete(item.tag);
        }
    }
}
