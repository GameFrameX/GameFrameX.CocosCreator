/**
 * 远程 Bundle 版本清单(Patch 六步的自定义 manifest;spec §3.4)。
 * 部署于远程(CDN 主备),静态 JSON。
 */
export interface PatchManifest {
    /** 清单版本(单调递增;诊断用) */
    version: number;
    /** bundle 名 → 内容哈希(md5;变化即需更新,Cocos Bundle md5Cache 语义) */
    bundles: Record<string, string>;
}

/** 简单 KV(get/set)持久化抽象;Cocos 侧由 SettingModule(sys.localStorage)实现 */
export interface IVersionKv {
    get(key: string): string | null;
    set(key: string, value: string): void;
}

const KEY_PREFIX = "patch.version.";

/**
 * 本地 bundle 版本记录(Patch 六步的 UpdateManifest 阶段读写)。
 */
export class VersionStore {
    private readonly _kv: IVersionKv;

    constructor(kv: IVersionKv) {
        this._kv = kv;
    }

    public get(bundleName: string): string | null {
        return this._kv.get(KEY_PREFIX + bundleName);
    }

    public set(bundleName: string, hash: string): void {
        this._kv.set(KEY_PREFIX + bundleName, hash);
    }
}

/** 差异更新计划 */
export interface PatchPlan {
    /** 与本地记录存在差异(或首次)需重载的 bundle 名 */
    bundlesToUpdate: string[];
    /** 无差异(全部最新) */
    upToDate: boolean;
}

/**
 * Patch 计划器(引擎无关;UpdateManifest 阶段的核心决策)。
 *
 * 契约:逐个比较 manifest 哈希与本地记录——未记录(首装)或不同即列入更新;
 * 全部一致则 upToDate(启动链可跳过下载直达 PatchDone)。
 */
export default class PatchPlanner {
    /**
     * 生成差异计划。
     * @param manifest 远程清单(UpdateStaticVersion 拉取)
     * @param store 本地版本记录
     * @param bundleNames 参与检查的远程 bundle 集合
     */
    public static plan(manifest: PatchManifest, store: VersionStore, bundleNames: ReadonlyArray<string>): PatchPlan {
        const bundlesToUpdate = bundleNames.filter((name) => {
            const remote = manifest.bundles[name];
            if (remote === undefined) {
                return false;
            }
            return store.get(name) !== remote;
        });
        return { bundlesToUpdate, upToDate: bundlesToUpdate.length === 0 };
    }

    /**
     * 应用计划(下载成功后写入新版本记录;DownloadWebFiles 完成时调用)。
     */
    public static apply(plan: PatchPlan, manifest: PatchManifest, store: VersionStore): void {
        for (const name of plan.bundlesToUpdate) {
            const hash = manifest.bundles[name];
            if (hash !== undefined) {
                store.set(name, hash);
            }
        }
    }
}
