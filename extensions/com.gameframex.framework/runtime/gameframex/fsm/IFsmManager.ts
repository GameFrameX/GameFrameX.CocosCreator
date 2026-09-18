import type FsmBase from "./FsmBase";
import type Fsm from "./Fsm";
import type FsmState from "./FsmState";
import type IFsm from "./IFsm";
import type TypeCtor from "./TypeCtor";

/**
 * 有限状态机管理器接口。
 *
 * 对照 Unity `GameFrameX.Fsm.Runtime.IFsmManager`。
 */
export default interface IFsmManager {
    /** 获取有限状态机数量。 */
    readonly Count: number;

    /** 检查是否存在有限状态机。 */
    HasFsm<T extends object>(ownerType: TypeCtor<T>, name?: string): boolean;

    /** 获取有限状态机。 */
    GetFsm<T extends object>(ownerType: TypeCtor<T>, name?: string): IFsm<T> | null;

    /** 获取所有有限状态机。 */
    GetAllFsms(): FsmBase[];

    /** 创建有限状态机。 */
    CreateFsm<T extends object>(name: string, owner: T, states: FsmState<T>[]): IFsm<T>;

    /** 销毁指定有限状态机实例。 */
    DestroyFsmByInstance(fsm: FsmBase): boolean;

    /** 销毁有限状态机。 */
    DestroyFsm<T extends object>(ownerType: TypeCtor<T>, name?: string): boolean;
}
