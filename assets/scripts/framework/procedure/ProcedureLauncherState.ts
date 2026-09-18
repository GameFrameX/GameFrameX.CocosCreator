import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureGetGlobalInfoState from "./ProcedureGetGlobalInfoState";

/**
 * 启动入口流程。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureLauncherState` 同名职责:
 * 拉起启动 UI 后切换到获取全局信息流程。
 * 骨架阶段仅记录链序轨迹与日志;启动 UI 拉起为 Phase 5 实装位。
 */
export default class ProcedureLauncherState extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureLauncherState] OnEnter: 启动入口(拉起启动 UI 为 Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureGetGlobalInfoState);
    }
}
