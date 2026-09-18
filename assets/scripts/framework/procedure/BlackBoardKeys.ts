import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import type ProcedureBase from "../../../gameframex/procedure/ProcedureBase";

/**
 * 流程 BlackBoard key 常量。
 *
 * 对照 Unity `GameFrameX.Startup.Runtime.BlackBoardKeys` 同名同值:
 * 启动层(StartupRunner)通过这些 key 向流程状态机注入 options/uiHandler/hotfixLauncher,
 * 各流程经 `IFsm<IProcedureManager>.GetData(key)` 读取(Phase 5 实装接线)。
 */
export default class BlackBoardKeys {
    /** StartupOptions 实例的 BlackBoard key。 */
    public static readonly StartupOptions: string = "__startup_options__";

    /** 启动 UI 处理器实例的 BlackBoard key。 */
    public static readonly StartupUIHandler: string = "__startup_ui_handler__";

    /** 热更启动器实例的 BlackBoard key。 */
    public static readonly StartupHotfixLauncher: string = "__startup_hotfix_launcher__";

    /** 启动完成通知源的 BlackBoard key。 */
    public static readonly StartupCompletionSource: string = "__startup_completion_source__";

    /** 启动链序轨迹的 BlackBoard key:每个流程 OnEnter 追加自身类名,用于启动链诊断。 */
    public static readonly StartupTrace: string = "__startup_procedure_trace__";
}

/**
 * 向流程 BlackBoard 追加当前流程类名(全部启动流程 OnEnter 统一调用,保证链序轨迹行为一致)。
 * @param fsm 流程状态机引用
 * @param state 当前流程实例
 */
export function appendStartupTrace(fsm: IFsm<IProcedureManager>, state: ProcedureBase): void {
    const trace = fsm.GetData<string[]>(BlackBoardKeys.StartupTrace) ?? [];
    trace.push(state.constructor.name);
    fsm.SetData(BlackBoardKeys.StartupTrace, trace);
}
