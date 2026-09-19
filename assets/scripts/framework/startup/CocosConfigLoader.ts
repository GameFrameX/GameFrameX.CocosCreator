import { AssetManager, assetManager, JsonAsset } from "cc";
import type { TableLoader } from "../../../gameframex/config/ConfigModule";

/** base Bundle 内配置表名(luban 生成物固定集合;与 TablesComponent 构造一致) */
const TABLE_NAMES = [
    "tables_tbachievementconfig",
    "tables_tbsoundsconfig",
    "tables_tbitemconfig",
    "local_tblocalization",
];

/**
 * base Bundle 配置加载器(引擎侧 TableLoader 实现;spec §3.3)。
 *
 * 契约:先 `prepare()` 预载全部表 JSON(loadBundle + 逐表 load),完成后返回**同步**查表函数
 * (luban TablesComponent 构造为同步遍历);调用方将其经 BlackBoard 传递至 ProcedureGameLauncherState。
 */
export default class CocosConfigLoader {
    private readonly _tables: Map<string, unknown> = new Map();

    /**
     * 预载 base Bundle 全部配置表;幂等(已加载直接返回查表函数)。
     */
    public async prepare(): Promise<TableLoader> {
        if (this._tables.size > 0) {
            return (name: string) => this._tables.get(name);
        }
        const bundle = await new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle("base", (err, loaded) => {
                if (err || !loaded) {
                    reject(new Error(`[CocosConfigLoader] base Bundle 加载失败:${err?.message ?? "no bundle"}`));
                    return;
                }
                resolve(loaded);
            });
        });
        await Promise.all(
            TABLE_NAMES.map(
                (name) =>
                    new Promise<void>((resolve, reject) => {
                        bundle.load(`${name}.json`, JsonAsset, (err, asset) => {
                            if (err || !asset) {
                                reject(new Error(`[CocosConfigLoader] 表加载失败:${name}(${err?.message ?? "no asset"})`));
                                return;
                            }
                            this._tables.set(name, asset.json);
                            resolve();
                        });
                    })
            )
        );
        return (name: string) => this._tables.get(name);
    }
}
