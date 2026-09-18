/**
 * 引用池(对照 Unity com.gameframex.unity ObjectPool/ReferencePool 语义的 TS 等价物)。
 *
 * 契约:按类型缓存"可重置"对象;acquire 取出并保证已 reset,release 归还前自动 reset。
 * 与 ObjectPool 的区别:ReferencePool 按类型注册、全局访问,适合 FSM/事件参数等框架级对象。
 */
export interface IReference {
    /** 归还/取出时调用,重置对象状态 */
    reset(): void;
}

export default class ReferencePool {
    private static _pools: Map<Function, IReference[]> = new Map();

    /**
     * 取出一个指定类型的引用对象(自动 reset)
     */
    public static acquire<T extends IReference>(type: new () => T): T {
        const pool = this._pools.get(type);
        if (pool && pool.length > 0) {
            const obj = pool.pop() as T;
            obj.reset();
            return obj;
        }
        return new type();
    }

    /**
     * 归还引用对象(归还前自动 reset)
     */
    public static release(obj: IReference): void {
        obj.reset();
        const type = obj.constructor as Function;
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        pool.push(obj);
    }

    /**
     * 清空全部引用池(类型维度)
     */
    public static clearAll(): void {
        this._pools.clear();
    }
}
