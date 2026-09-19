import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedurePatchDone from "./ProcedurePatchDone";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";
import { getPatchManifest } from "./PatchContext";
import type { PatchPlan } from "../../../gameframex/download/PatchPlanner";

/**
 * ProcedureDownloadWebFiles(Patch 六步第 5 步;spec §3.4)。按差异计划加载远程 Bundle(逐个,聚合进度)。
 */
export default class ProcedureDownloadWebFiles extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedurePatchDone);
            return;
        }
        const plan = fsm.GetData<PatchPlan>("__patch_plan__");
        const bundles = plan && !plan.upToDate ? plan.bundlesToUpdate : [];
        if (bundles.length === 0) {
            logPatch("DownloadWebFiles", "无差异,跳过下载");
            emitPatchProgress(context.events, "DownloadWebFiles", 1);
            this.ChangeState(fsm, ProcedurePatchDone);
            return;
        }
        logPatch("DownloadWebFiles", `下载差异 Bundle:${bundles.join(",")}`);
        let done = 0;
        void (async () => {
            for (const name of bundles) {
                await context.service.loadRemoteBundle(name, context.server, (p) => {
                    const overall = (done + p) / bundles.length;
                    emitPatchProgress(context.events, "DownloadWebFiles", overall);
                });
                done++;
            }
            emitPatchProgress(context.events, "DownloadWebFiles", 1);
            this.ChangeState(fsm, ProcedurePatchDone);
        })().catch((error) => Log.error("Patch", "差异下载失败", error));
    }
}
