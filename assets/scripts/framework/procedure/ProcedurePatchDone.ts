import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureGameLauncherState from "./ProcedureGameLauncherState";

/**
 * 资源包补丁完成流程(Patch 第 6/6 步)。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.ProcedurePatchDone` 同名职责:
 * 更新启动 UI 补丁状态后切换到游戏启动器流程。
 * 骨架阶段仅记录链序轨迹与日志;AssetPatchStatesChange 进度事件为 Phase 5 实装位。
 */
export default class ProcedurePatchDone extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        Log.info("Procedure", "[ProcedurePatchDone] OnEnter: Patch 6/6 补丁完成(进度事件为 Phase 5 实装位)");
        this.ChangeState(fsm, ProcedureGameLauncherState);
    }
}
