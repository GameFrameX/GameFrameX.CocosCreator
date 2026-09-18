import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureUpdateManifest from "./ProcedureUpdateManifest";

/**
 * 更新静态版本流程(Patch 第 2/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureUpdateStaticVersion` 同名职责:
 * 请求远程静态版本号后切换到更新资源清单流程。
 * 骨架阶段仅记录链序轨迹与日志;自定义版本清单请求为 Phase 5 实装位。
 */
export default class ProcedureUpdateStaticVersion extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureUpdateStaticVersion] OnEnter: Patch 2/6 更新静态版本(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureUpdateManifest);
    }
}
