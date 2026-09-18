import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState from "./ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState";

/**
 * 获取应用版本信息流程。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureGetAppVersionInfoState` 同名职责:
 * 获取应用版本后切换到获取默认资源包版本信息流程。
 * 骨架阶段仅记录链序轨迹与日志;版本信息获取为 Phase 5 实装位。
 */
export default class ProcedureGetAppVersionInfoState extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureGetAppVersionInfoState] OnEnter: 获取应用版本信息(Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState);
    }
}
