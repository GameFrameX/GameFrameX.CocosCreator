/**
 * 泛型对象池(与 LayaBox 版同契约)。
 *
 * 契约:池空时通过 objectFactory 新建;池满时丢弃回收对象并告警。
 * 用于 NetworkChannel 收发包缓冲、粒子等高频对象复用,避免 GC 抖动。
 */
export default class ObjectPool<T> {
    private pool: T[] = [];
    private maxSize: number;
    private objectFactory: () => T;

    /**
     * @param maxSize 对象池最大容量
     * @param objectFactory 当对象池为空时的创建工厂函数
     */
    constructor(maxSize: number, objectFactory: () => T) {
        this.maxSize = maxSize;
        this.objectFactory = objectFactory;
    }

    /**
     * 存放对象到对象池
     */
    addObject(obj: T) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        } else {
            console.warn("Object pool is full, cannot add more objects.");
        }
    }

    /**
     * 从对象池获取对象;池空时由工厂新建
     */
    getObject(): T {
        const cached = this.pool.pop();
        return cached !== undefined ? cached : this.objectFactory();
    }

    /**
     * 当前池内缓存数量
     */
    get count(): number {
        return this.pool.length;
    }

    /**
     * 清空对象池
     */
    clear() {
        this.pool.length = 0;
    }
}
