import type { IModule } from "../GameEntry";
import type IFsm from "../fsm/IFsm";
import type IFsmManager from "../fsm/IFsmManager";
import type TypeCtor from "../fsm/TypeCtor";
import ProcedureBase from "./ProcedureBase";
import type IProcedureManager from "./IProcedureManager";

/**
 * 流程管理器。
 *
 * 对照 Unity `GameFrameX.Procedure.Runtime.ProcedureManager`:
 * 持有一个以自身为 Owner 的 Procedure FSM(其 BlackBoard 即流程黑板,跨流程数据经
 * IFsm.GetData/SetData 传递);Initialize 注入 FsmManager 与流程集合,
 * StartProcedure 启动入口流程;轮询由该 FSM 注册进的 FsmManager 承担,本类 update 为空。
 */
export default class ProcedureManager implements IProcedureManager, IModule {
    /** 流程状态机名称(注册进 FsmManager 的键)。 */
    private static readonly PROCEDURE_FSM_NAME: string = "Procedure";

    private m_FsmManager: IFsmManager | null = null;
    private m_ProcedureFsm: IFsm<IProcedureManager> | null = null;

    /**
     * 获取当前流程;未 Initialize 为编程错误。
     */
    public get CurrentProcedure(): ProcedureBase | null {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        return this.m_ProcedureFsm.CurrentState as ProcedureBase | null;
    }

    /**
     * 获取当前流程持续时间(秒);未 Initialize 为编程错误。
     */
    public get CurrentProcedureTime(): number {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        return this.m_ProcedureFsm.CurrentStateTime;
    }

    /**
     * 初始化流程管理器:创建以自身为持有者的流程状态机(BlackBoard 随之建立)。
     * @param fsmManager 有限状态机管理器
     * @param procedures 流程管理器包含的流程
     */
    public Initialize(fsmManager: IFsmManager, procedures: ProcedureBase[]): void {
        if (fsmManager == null) {
            throw new Error("fsmManager is invalid.");
        }

        if (procedures == null || procedures.length <= 0) {
            throw new Error("Procedures is invalid.");
        }

        this.m_FsmManager = fsmManager;
        this.m_ProcedureFsm = fsmManager.CreateFsm(ProcedureManager.PROCEDURE_FSM_NAME, this, procedures);
    }

    /**
     * 开始流程。
     * @param procedureType 要开始的流程类型
     */
    /**
     * 流程黑板访问(启动层经此注入 StartupOptions/HotfixLauncher 等;对照 Unity BlackBoard 语义)。
     * 未 Initialize 时为编程错误。
     */
    public get BlackBoard(): IFsm<IProcedureManager> {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        return this.m_ProcedureFsm;
    }

    public StartProcedure(procedureType: TypeCtor<ProcedureBase>): void {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        this.m_ProcedureFsm.Start(procedureType as TypeCtor<ProcedureBase>);
    }

    /**
     * 是否存在流程。
     * @param procedureType 要检查的流程类型
     */
    public HasProcedure(procedureType: TypeCtor<ProcedureBase>): boolean {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        return this.m_ProcedureFsm.HasState(procedureType);
    }

    /**
     * 获取流程。
     * @param procedureType 要获取的流程类型
     */
    public GetProcedure(procedureType: TypeCtor<ProcedureBase>): ProcedureBase | null {
        if (this.m_ProcedureFsm == null) {
            throw new Error("You must initialize procedure first.");
        }

        return this.m_ProcedureFsm.GetState(procedureType) as ProcedureBase | null;
    }

    /**
     * 销毁当前流程状态机并清空 BlackBoard(保留 FsmManager 依赖,可再 Initialize)。
     */
    public DestroyProcedures(): void {
        if (this.m_FsmManager != null && this.m_ProcedureFsm != null) {
            this.m_FsmManager.DestroyFsm(ProcedureManager, ProcedureManager.PROCEDURE_FSM_NAME);
        }

        this.m_ProcedureFsm = null;
    }

    /**
     * 销毁后以新的流程集合重建(需要重新 StartProcedure)。
     * @param procedures 流程管理器包含的流程
     */
    public ReinitializeProcedures(procedures: ProcedureBase[]): void {
        if (this.m_FsmManager == null) {
            throw new Error("You must initialize procedure first.");
        }

        this.DestroyProcedures();
        this.m_ProcedureFsm = this.m_FsmManager.CreateFsm(ProcedureManager.PROCEDURE_FSM_NAME, this, procedures);
    }

    /**
     * 模块初始化(由 GameEntry 调用;流程集合由启动层通过 Initialize 注入)。
     */
    public async init(): Promise<void> {
    }

    /**
     * 模块轮询(由 GameEntry 调用;流程轮询由 FsmManager 驱动,本类无每帧职责)。
     */
    public update(_dt: number): void {
    }

    /**
     * 关闭并清理流程管理器:销毁流程状态机并释放 FsmManager 依赖。
     */
    public shutdown(): void {
        if (this.m_FsmManager != null) {
            if (this.m_ProcedureFsm != null) {
                this.m_FsmManager.DestroyFsm(ProcedureManager, ProcedureManager.PROCEDURE_FSM_NAME);
                this.m_ProcedureFsm = null;
            }

            this.m_FsmManager = null;
        }
    }
}
