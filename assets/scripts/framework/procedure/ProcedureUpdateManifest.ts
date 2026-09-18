import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureCreateDownloader from "./ProcedureCreateDownloader";

/**
 * 更新资源清单流程(Patch 第 3/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureUpdateManifest` 同名职责:
 * 对比本地与远程清单后切换到创建下载器流程。
 * 骨架阶段仅记录链序轨迹与日志;清单比对(md5 差异)为 Phase 5 实装位。
 */
export default class ProcedureUpdateManifest extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureUpdateManifest] OnEnter: Patch 3/6 更新资源清单(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureCreateDownloader);
    }
}
