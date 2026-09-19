import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureCreateDownloader from "./ProcedureCreateDownloader";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";
import { getPatchManifest } from "./PatchContext";
import PatchPlanner from "../../../gameframex/download/PatchPlanner";

/**
 * ProcedureUpdateManifest(Patch 六步第 3 步;spec §3.4)。比对远程清单与本地记录,生成差异计划。
 */
export default class ProcedureUpdateManifest extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedureCreateDownloader);
            return;
        }
        const manifest = getPatchManifest(fsm);
        const plan = PatchPlanner.plan(manifest, context.store, context.bundleNames);
        fsm.SetData("__patch_plan__", plan);
        logPatch("UpdateManifest", plan.upToDate ? "版本一致,无差异" : `差异 Bundle:${plan.bundlesToUpdate.join(",")}`);
        emitPatchProgress(context.events, "UpdateManifest", 1);
        this.ChangeState(fsm, ProcedureCreateDownloader);
    }
}
