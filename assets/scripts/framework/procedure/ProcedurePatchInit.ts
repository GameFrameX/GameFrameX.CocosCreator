import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureUpdateStaticVersion from "./ProcedureUpdateStaticVersion";

/**
 * 资源包补丁初始化流程(Patch 第 1/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedurePatchInit` 同名职责:
 * 按运行模式初始化资源包后切换到更新静态版本流程。
 * 骨架阶段仅记录链序轨迹与日志;远程 Bundle 初始化(替代 YooAsset)为 Phase 5 实装位。
 */
export default class ProcedurePatchInit extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedurePatchInit] OnEnter: Patch 1/6 资源包初始化(远程 Bundle 初始化为 Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureUpdateStaticVersion);
    }
}
