import type { IModule } from "../GameEntry";

/**
 * 表加载器:传入表名返回该表 JSON 数据(引擎侧由 assetManager.loadAny 实现,测试侧由 fs 实现)。
 */
export type TableLoader = (name: string) => unknown;

/**
 * 表集工厂:业务侧注入(如 luban 生成的 `new TablesComponent(loader)`);
 * 框架层不感知具体生成物类型,消除 framework → hotfix 的反向依赖。
 */
export type TablesFactory<T> = (loader: TableLoader) => T;

/**
 * 配置模块(对照 Unity GameApp.Config 契约;spec §3.3)。
 *
 * 契约:
 * - `loadAsync(loader, tablesFactory)` 由业务侧注入表集工厂完成灌注(luban 4 表 + 本地化表)。
 * - `GetConfig<T>(tableName)` 按表名取表实例(如 "TbItemConfig");未加载完成时抛错(编程错误)。
 * - 引擎无关、生成物无关:框架层不 import 任何生成代码(扩展化后框架位于扩展内,业务生成物在项目 hotfix 侧)。
 */
export default class ConfigModule implements IModule {
    private _tables: unknown = null;

    /**
     * 加载全部配置表;重复调用以最后一次为准(重新灌注)。
     *
     * @param loader 表名 → JSON 数据(Cocos 侧 assetManager.loadAny,Node 侧 fs)
     * @param tablesFactory 表集构造(luban:`(loader) => new TablesComponent(loader)`)
     */
    public loadAsync<T>(loader: TableLoader, tablesFactory: TablesFactory<T>): Promise<T> {
        const tables = tablesFactory(loader);
        this._tables = tables;
        return Promise.resolve(tables);
    }

    /**
     * 按表名取配置表;未加载时抛错。
     */
    public GetConfig<T = unknown>(tableName: string): T {
        if (this._tables === null) {
            throw new Error("[ConfigModule] 配置尚未加载,请先 loadAsync");
        }
        // 注入的表集(生成物)无字符串索引签名;边界处经 unknown 中转按名取表
        const table = (this._tables as Record<string, unknown>)[tableName];
        if (table === undefined) {
            throw new Error(`[ConfigModule] 不存在的配置表: ${tableName}`);
        }
        return table as T;
    }

    /**
     * 暴露注入的表集原始对象(本地化灌注等需要跨表访问的场景)。
     */
    public get tables(): unknown {
        return this._tables;
    }

    public async init(): Promise<void> {
        // 实际加载由启动流程显式调用 loadAsync(需要引擎侧 loader);init 保持空操作。
    }

    public update(_dt: number): void {}

    public shutdown(): void {
        this._tables = null;
    }
}
