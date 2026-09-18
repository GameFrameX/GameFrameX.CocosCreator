/**
 * 自研事件池(引擎无关;对照 Unity com.gameframex.unity.event 的 EventPool 语义)。
 *
 * 契约:
 * - `on(eventId, handler, target?)` 订阅;同一 handler 重复订阅只保留一次(去重)。
 * - `emit(eventId, data)` 同步派发;单个 handler 抛错被捕获并告警,不影响其余 handler 与派发方。
 * - `once` 触发后自动退订;`off`/`offAll`/`clear` 负责退订,界面关闭路径必须调用避免泄漏。
 */
export type EventHandler = (data: unknown) => void;

interface Subscription {
    handler: EventHandler;
    once: boolean;
}

export default class EventSystems {
    private _handlers: Map<string, Subscription[]> = new Map();

    /**
     * 订阅事件;同一 handler 重复订阅只生效一次。
     */
    public on(eventId: string, handler: EventHandler): void {
        this.subscribe(eventId, handler, false);
    }

    /**
     * 订阅一次;首次触发后自动退订。
     */
    public once(eventId: string, handler: EventHandler): void {
        this.subscribe(eventId, handler, true);
    }

    private subscribe(eventId: string, handler: EventHandler, once: boolean): void {
        let list = this._handlers.get(eventId);
        if (!list) {
            list = [];
            this._handlers.set(eventId, list);
        }
        if (list.some((item) => item.handler === handler)) {
            return;
        }
        list.push({ handler, once });
    }

    /**
     * 退订指定 handler;未订阅时静默忽略。
     */
    public off(eventId: string, handler: EventHandler): void {
        const list = this._handlers.get(eventId);
        if (!list) {
            return;
        }
        const idx = list.findIndex((item) => item.handler === handler);
        if (idx >= 0) {
            list.splice(idx, 1);
        }
        if (list.length === 0) {
            this._handlers.delete(eventId);
        }
    }

    /**
     * 退订指定事件的全部 handler。
     */
    public offAll(eventId: string): void {
        this._handlers.delete(eventId);
    }

    /**
     * 同步派发;单个 handler 异常被捕获告警,不中断其余 handler。
     */
    public emit(eventId: string, data: unknown): void {
        const list = this._handlers.get(eventId);
        if (!list || list.length === 0) {
            return;
        }
        // 拷贝快照:派发中允许 handler 安全地退订/新增订阅
        const snapshot = Array.from(list);
        const expired: Subscription[] = [];
        for (const item of snapshot) {
            try {
                item.handler(data);
            } catch (error) {
                console.error(`[EventSystems] 事件 "${eventId}" handler 执行异常`, error);
            }
            if (item.once) {
                expired.push(item);
            }
        }
        for (const item of expired) {
            this.off(eventId, item.handler);
        }
    }

    /**
     * 指定事件当前订阅数(测试与泄漏诊断用)。
     */
    public listenerCount(eventId: string): number {
        return this._handlers.get(eventId)?.length ?? 0;
    }

    /**
     * 清空全部订阅(模块 shutdown 用)。
     */
    public clear(): void {
        this._handlers.clear();
    }
}
