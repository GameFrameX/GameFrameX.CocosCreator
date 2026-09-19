import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureUpdateStaticVersion from "./ProcedureUpdateStaticVersion";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";

/**
 * ProcedurePatchInit(Patch 六步第 1 步;spec §3.4)。校验 PatchContext 并开始 Patch 流程。
 */
export default class ProcedurePatchInit extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedureUpdateStaticVersion);
            return;
        }
        logPatch("PatchInit", `Patch 初始化:${context.bundleNames.length} 个远程 Bundle,server=${context.server}`);
        emitPatchProgress(context.events, "PatchInit", 0);
        this.ChangeState(fsm, ProcedureUpdateStaticVersion);
    }
}
