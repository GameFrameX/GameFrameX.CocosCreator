import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureDownloadWebFiles from "./ProcedureDownloadWebFiles";

/**
 * 创建差异下载器流程(Patch 第 4/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureCreateDownloader` 同名职责:
 * 依据清单差异创建下载器后切换到下载差异文件流程。
 * 骨架阶段仅记录链序轨迹与日志;assetManager.downloader 封装为 Phase 5 实装位。
 */
export default class ProcedureCreateDownloader extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureCreateDownloader] OnEnter: Patch 4/6 创建差异下载器(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureDownloadWebFiles);
    }
}
