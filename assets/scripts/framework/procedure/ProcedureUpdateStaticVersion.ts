import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureUpdateManifest from "./ProcedureUpdateManifest";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";
import { setPatchManifest } from "./PatchContext";

/**
 * ProcedureUpdateStaticVersion(Patch 六步第 2 步;spec §3.4)。拉取远程版本清单并暂存至 BlackBoard。
 */
export default class ProcedureUpdateStaticVersion extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedureUpdateManifest);
            return;
        }
        logPatch("UpdateStaticVersion", `拉取版本清单:${context.manifestUrl}`);
        context.service
            .fetchManifest(context.manifestUrl)
            .then((manifest) => {
                setPatchManifest(fsm, manifest);
                emitPatchProgress(context.events, "UpdateStaticVersion", 1);
                this.ChangeState(fsm, ProcedureUpdateManifest);
            })
            .catch((error) => Log.error("Patch", "清单拉取失败", error));
    }
}
