import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedurePatchDone from "./ProcedurePatchDone";

/**
 * 下载差异文件流程(Patch 第 5/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureDownloadWebFiles` 同名职责:
 * 下载远程差异资源(CDN 主备)后切换到补丁完成流程。
 * 骨架阶段仅记录链序轨迹与日志;差异下载与进度事件为 Phase 5 实装位。
 */
export default class ProcedureDownloadWebFiles extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureDownloadWebFiles] OnEnter: Patch 5/6 下载差异文件(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedurePatchDone);
    }
}
