import type IFsmManager from "../fsm/IFsmManager";
import type IFsm from "../fsm/IFsm";
import type ProcedureBase from "./ProcedureBase";
import type TypeCtor from "../fsm/TypeCtor";

/**
 * 流程管理器接口。
 *
 * 对照 Unity `GameFrameX.Procedure.Runtime.IProcedureManager`。
 */
export default interface IProcedureManager {
    /** 流程黑板(启动层注入/流程读取;未 Initialize 抛错)。 */
    readonly BlackBoard: IFsm<IProcedureManager>;

    /** 获取当前流程。 */
    readonly CurrentProcedure: ProcedureBase | null;

    /** 获取当前流程持续时间。 */
    readonly CurrentProcedureTime: number;

    /** 初始化流程管理器。 */
    Initialize(fsmManager: IFsmManager, procedures: ProcedureBase[]): void;

    /** 开始流程。 */
    StartProcedure(procedureType: TypeCtor<ProcedureBase>): void;

    /** 是否存在流程。 */
    HasProcedure(procedureType: TypeCtor<ProcedureBase>): boolean;

    /** 获取流程。 */
    GetProcedure(procedureType: TypeCtor<ProcedureBase>): ProcedureBase | null;

    /** 销毁当前流程状态机并清空注册表。 */
    DestroyProcedures(): void;

    /** 销毁后以新的流程集合重建。 */
    ReinitializeProcedures(procedures: ProcedureBase[]): void;
}
