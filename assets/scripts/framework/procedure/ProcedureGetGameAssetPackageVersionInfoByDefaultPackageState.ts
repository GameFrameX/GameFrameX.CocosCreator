import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedurePatchInit from "./ProcedurePatchInit";

/**
 * 获取默认资源包版本信息流程。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState` 同名职责:
 * 获取默认资源包版本后切换到资源包补丁初始化流程(进入 Patch 六步)。
 * 骨架阶段仅记录链序轨迹与日志;资源包版本获取为 Phase 5 实装位。
 */
export default class ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState] OnEnter: 获取默认资源包版本信息(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedurePatchInit);
    }
}
