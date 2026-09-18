import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";

/**
 * 游戏启动器流程(启动链终态)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedureGameLauncherState` 同名职责:
 * 执行热更启动器并等待游戏初始化完成;无后继流程。
 * 骨架阶段仅记录链序轨迹与日志;HotfixLauncher.main() 三步接线为 Phase 5 实装位。
 */
export default class ProcedureGameLauncherState extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedureGameLauncherState] OnEnter: 启动链完成,等待 HotfixLauncher 接线(Phase 5 实装位)");
    }
}
