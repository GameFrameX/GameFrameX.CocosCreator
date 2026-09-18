/**
 * 模块注册表(对照 Unity GameFrameX 的 GameEntry 语义;spec §1)。
 *
 * 契约:
 * - `IModule { init(): Promise<void>; update(dt): void; shutdown(): void }` 是全部模块的生命周期接口。
 * - Launcher 场景常驻节点 `GameEntryComponent.update()` 每帧调用 `GameEntry.updateAll(dt)` 驱动全部模块。
 * - initAll 按注册顺序初始化;shutdownAll 逆序关闭;重复注册/未注册访问均为编程错误,直接抛错。
 */
export interface IModule {
    init(): Promise<void>;
    update(dt: number): void;
    shutdown(): void;
}

export default class GameEntry {
    private static _modules: Map<string, IModule> = new Map<string, IModule>();

    /**
     * 注册模块;同名重复注册抛错(编程错误,禁止静默覆盖)。
     */
    public static registerModule(name: string, module: IModule): void {
        if (this._modules.has(name)) {
            throw new Error(`[GameEntry] 模块重复注册: ${name}`);
        }
        this._modules.set(name, module);
    }

    /**
     * 按名取模块(每名单例);未注册抛错。
     */
    public static getModule<T extends IModule>(name: string): T {
        const module = this._modules.get(name);
        if (!module) {
            throw new Error(`[GameEntry] 模块未注册: ${name}`);
        }
        return module as T;
    }

    /**
     * 是否已注册指定模块。
     */
    public static hasModule(name: string): boolean {
        return this._modules.has(name);
    }

    /**
     * 注销模块(测试隔离与显式卸载用;不调用其 shutdown)。
     */
    public static unregisterModule(name: string): void {
        this._modules.delete(name);
    }

    /**
     * 按注册顺序初始化全部模块(任一失败则中断并向上抛出)。
     */
    public static async initAll(): Promise<void> {
        for (const module of this._modules.values()) {
            await module.init();
        }
    }

    /**
     * 每帧驱动全部模块(由 GameEntryComponent.update 调用)。
     */
    public static updateAll(dt: number): void {
        for (const module of this._modules.values()) {
            module.update(dt);
        }
    }

    /**
     * 逆序关闭全部模块(后初始化的先关闭)。
     */
    public static shutdownAll(): void {
        const names = Array.from(this._modules.keys()).reverse();
        for (const name of names) {
            this._modules.get(name)!.shutdown();
        }
    }

    /**
     * 测试隔离:清空注册表(不调用 shutdown)。
     */
    public static reset(): void {
        this._modules.clear();
    }
}
