import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureGameLauncherState from "./ProcedureGameLauncherState";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";
import { getPatchManifest } from "./PatchContext";
import PatchPlanner, { type PatchPlan } from "../../../gameframex/download/PatchPlanner";

/**
 * ProcedurePatchDone(Patch 六步第 6 步;spec §3.4)。写入版本记录并完成 Patch 段。
 */
export default class ProcedurePatchDone extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedureGameLauncherState);
            return;
        }
        const plan = fsm.GetData<PatchPlan>("__patch_plan__");
        if (plan && !plan.upToDate) {
            PatchPlanner.apply(plan, getPatchManifest(fsm), context.store);
            logPatch("PatchDone", `已记录新版本:${plan.bundlesToUpdate.join(",")}`);
        } else {
            logPatch("PatchDone", "Patch 完成(无变更)");
        }
        emitPatchProgress(context.events, "PatchDone", 1);
        this.ChangeState(fsm, ProcedureGameLauncherState);
    }
}
