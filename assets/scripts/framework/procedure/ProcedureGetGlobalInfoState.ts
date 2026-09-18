import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureGetAppVersionInfoState from "./ProcedureGetAppVersionInfoState";

/**
 * 获取全局信息流程。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureGetGlobalInfoState` 同名职责:
 * 拉取远程全局配置后切换到获取应用版本信息流程。
 * 骨架阶段仅记录链序轨迹与日志;全局信息拉取为 Phase 5 实装位。
 */
export default class ProcedureGetGlobalInfoState extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureGetGlobalInfoState] OnEnter: 获取全局信息(远程配置拉取为 Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureGetAppVersionInfoState);
    }
}
