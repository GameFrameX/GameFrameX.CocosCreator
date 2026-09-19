/**
 * Patch 六步测试 harness:组装 FsmManager/ProcedureManager + 注入 PatchContext(mock service),
 * 驱动启动链到完成,返回可断言的观测结果。
 */
import FsmManager from "../../assets/gameframex/fsm/FsmManager";
import ProcedureManager from "../../assets/gameframex/procedure/ProcedureManager";
import ProcedureGameLauncherState from "../../assets/scripts/framework/procedure/ProcedureGameLauncherState";
import ProcedureLauncherState from "../../assets/scripts/framework/procedure/ProcedureLauncherState";
import ProcedureGetGlobalInfoState from "../../assets/scripts/framework/procedure/ProcedureGetGlobalInfoState";
import ProcedureGetAppVersionInfoState from "../../assets/scripts/framework/procedure/ProcedureGetAppVersionInfoState";
import ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState from "../../assets/scripts/framework/procedure/ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState";
import ProcedurePatchInit from "../../assets/scripts/framework/procedure/ProcedurePatchInit";
import ProcedureUpdateStaticVersion from "../../assets/scripts/framework/procedure/ProcedureUpdateStaticVersion";
import ProcedureUpdateManifest from "../../assets/scripts/framework/procedure/ProcedureUpdateManifest";
import ProcedureCreateDownloader from "../../assets/scripts/framework/procedure/ProcedureCreateDownloader";
import ProcedureDownloadWebFiles from "../../assets/scripts/framework/procedure/ProcedureDownloadWebFiles";
import ProcedurePatchDone from "../../assets/scripts/framework/procedure/ProcedurePatchDone";
import EventSystems from "../../assets/gameframex/event/EventSystems";
import type { PatchManifest } from "../../assets/gameframex/download/PatchPlanner";
import { VersionStore } from "../../assets/gameframex/download/PatchPlanner";
import EventName from "../../assets/gameframex/event/EventName";

export interface PatchHarnessOptions {
    manifest: PatchManifest;
    localVersions: Map<string, string>;
}

export interface PatchHarnessResult {
    loadedBundles: string[];
    progressEvents: Array<{ stage: string; progress: number }>;
    records: Map<string, string>;
    reachedGameLauncher: boolean;
}

export async function run(opts: PatchHarnessOptions): Promise<PatchHarnessResult> {
    const result: PatchHarnessResult = {
        loadedBundles: [],
        progressEvents: [],
        records: new Map(),
        reachedGameLauncher: false,
    };

    const events = new EventSystems();
    events.on(EventName.PatchProgress, (data) => {
        result.progressEvents.push({ ...(data as { stage: string; progress: number }) });
    });

    const storeRecords = opts.localVersions;
    const service = {
        async fetchManifest(): Promise<PatchManifest> {
            return opts.manifest;
        },
        async loadRemoteBundle(name: string): Promise<void> {
            result.loadedBundles.push(name);
        },
    };

    const fsmManager = new FsmManager();
    const procedureManager = new ProcedureManager();
    procedureManager.Initialize(fsmManager, [
        new ProcedureLauncherState(),
        new ProcedureGetGlobalInfoState(),
        new ProcedureGetAppVersionInfoState(),
        new ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState(),
        new ProcedurePatchInit(),
        new ProcedureUpdateStaticVersion(),
        new ProcedureUpdateManifest(),
        new ProcedureCreateDownloader(),
        new ProcedureDownloadWebFiles(),
        new ProcedurePatchDone(),
        new ProcedureGameLauncherState(),
    ]);

    procedureManager.BlackBoard.SetData("__patch_context__", {
        manifestUrl: "mock://manifest.json",
        server: "mock://cdn",
        bundleNames: ["remote"],
        store: new VersionStore({ get: (k: string) => storeRecords.get(k) ?? null, set: (k: string, v: string) => void storeRecords.set(k, v) }),
        service,
        events,
    });

    procedureManager.StartProcedure(ProcedureLauncherState);

    // 异步链(清单 fetch → 逐 bundle 加载)等待完成:轮询至终态或超时
    for (let i = 0; i < 100; i++) {
        if (procedureManager.CurrentProcedure instanceof ProcedureGameLauncherState) {
            result.reachedGameLauncher = true;
            break;
        }
        await new Promise((r) => setTimeout(r, 10));
    }

    return result;
}
