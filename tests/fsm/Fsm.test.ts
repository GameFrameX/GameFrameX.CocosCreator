import { beforeEach, describe, expect, it } from "vitest";
import Fsm from "../../assets/gameframex/fsm/Fsm";
import FsmManager from "../../assets/gameframex/fsm/FsmManager";
import FsmState from "../../assets/gameframex/fsm/FsmState";
import type IFsm from "../../assets/gameframex/fsm/IFsm";

/**
 * FSM 契约(对照 Unity GameFrameX.Fsm.Runtime):
 * 创建/启动、update(dt) 帧驱动推进、状态迁移序、BlackBoard(GetData/SetData)存取与跨状态传递、
 * 状态查询(GetAllStates/HasState/GetState)、停止清理、FsmManager 管理与错误契约。
 */
describe("Fsm/FsmManager", () => {
    class Owner {
    }

    /** 迁移序与跨状态 BlackBoard 的事件记录。 */
    const order: string[] = [];

    class StateIdle extends FsmState<Owner> {
        public readonly events: string[] = [];

        public OnInit(_fsm: IFsm<Owner>): void {
            this.events.push("Idle:OnInit");
        }

        public OnEnter(fsm: IFsm<Owner>): void {
            this.events.push("Idle:OnEnter");
            fsm.SetData("idleEntered", true);
        }

        public OnUpdate(fsm: IFsm<Owner>, elapseSeconds: number, _realElapseSeconds: number): void {
            this.events.push("Idle:OnUpdate");
            fsm.SetData("idleElapsed", (fsm.GetData<number>("idleElapsed") ?? 0) + elapseSeconds);
        }

        public OnLeave(_fsm: IFsm<Owner>, isShutdown: boolean): void {
            this.events.push(`Idle:OnLeave:${isShutdown}`);
        }

        public OnDestroy(_fsm: IFsm<Owner>): void {
            this.events.push("Idle:OnDestroy");
        }
    }

    class StateA extends FsmState<Owner> {
        public OnEnter(fsm: IFsm<Owner>): void {
            fsm.SetData("token", "from-a");
            order.push("A:OnEnter");
        }

        public OnLeave(_fsm: IFsm<Owner>, isShutdown: boolean): void {
            order.push(`A:OnLeave:${isShutdown}`);
        }

        public OnUpdate(fsm: IFsm<Owner>, _elapseSeconds: number, _realElapseSeconds: number): void {
            this.ChangeState(fsm, StateB);
        }
    }

    class StateRun extends FsmState<Owner> {
        public updateCount: number = 0;

        public OnUpdate(fsm: IFsm<Owner>, _elapseSeconds: number, _realElapseSeconds: number): void {
            this.updateCount += 1;
            this.ChangeState(fsm, StateIdle);
        }
    }
    class StateB extends FsmState<Owner> {
        public OnEnter(fsm: IFsm<Owner>): void {
            order.push(`B:${fsm.GetData<string>("token")}`);
        }
    }

    beforeEach(() => {
        order.length = 0;
    });

    it("Create 时对每个状态调用一次 OnInit;Start 进入首个状态", () => {
        const owner = new Owner();
        const idle = new StateIdle();
        const fsm = Fsm.Create("main", owner, [idle, new StateRun()]);

        expect(idle.events).toEqual(["Idle:OnInit"]);
        expect(fsm.FsmStateCount).toBe(2);
        expect(fsm.Owner).toBe(owner);
        expect(fsm.FullName).toBe("Owner|main");
        expect(fsm.IsDestroyed).toBe(false);
        expect(fsm.IsRunning).toBe(false);

        fsm.Start(StateIdle);
        expect(idle.events).toEqual(["Idle:OnInit", "Idle:OnEnter"]);
        expect(fsm.IsRunning).toBe(true);
        expect(fsm.CurrentStateName).toBe("StateIdle");
        expect(fsm.CurrentState).toBeInstanceOf(StateIdle);
    });

    it("update 按帧驱动推进:OnUpdate 收到 dt 且 CurrentStateTime 累计", () => {
        const fsm = Fsm.Create("main", new Owner(), [new StateIdle(), new StateRun()]);
        fsm.Start(StateIdle);

        fsm.update(0.1, 0.1);
        fsm.update(0.1, 0.1);

        expect(fsm.GetData<number>("idleElapsed")).toBeCloseTo(0.2, 10);
        expect(fsm.CurrentStateTime).toBeCloseTo(0.2, 10);
    });

    it("状态迁移序:OnLeave(false) → 下一状态 OnEnter,且 BlackBoard 数据跨状态可读", () => {
        const fsm = Fsm.Create("main", new Owner(), [new StateA(), new StateB()]);
        fsm.Start(StateA);
        expect(order).toEqual(["A:OnEnter"]);

        fsm.update(0.016, 0.016);

        expect(order).toEqual(["A:OnEnter", "A:OnLeave:false", "B:from-a"]);
        expect(fsm.CurrentStateName).toBe("StateB");
    });

    it("OnUpdate 中 ChangeState:原状态当帧停止轮询,新状态自下一帧起轮询", () => {
        const idle = new StateIdle();
        const run = new StateRun();
        const fsm = Fsm.Create("main", new Owner(), [idle, run]);
        fsm.Start(StateRun);

        fsm.update(1, 1);
        fsm.update(1, 1);

        expect(fsm.CurrentStateName).toBe("StateIdle");
        expect(run.updateCount).toBe(1);
        expect(idle.events.filter((e) => e === "Idle:OnUpdate")).toHaveLength(1);
    });

    it("状态查询:HasState/GetState/GetAllStates", () => {
        const idle = new StateIdle();
        const run = new StateRun();
        const fsm = Fsm.Create("main", new Owner(), [idle, run]);

        expect(fsm.HasState(StateIdle)).toBe(true);
        expect(fsm.HasState(StateA)).toBe(false);
        expect(fsm.GetState(StateRun)).toBe(run);
        expect(fsm.GetState(StateA)).toBeNull();

        const all = fsm.GetAllStates();
        expect(all).toHaveLength(2);
        expect(all).toContain(idle);
        expect(all).toContain(run);
    });

    it("BlackBoard 存取:SetData/GetData/HasData/RemoveData", () => {
        const fsm = Fsm.Create("main", new Owner(), [new StateIdle(), new StateRun()]);

        expect(fsm.HasData("count")).toBe(false);
        expect(fsm.GetData<number>("count")).toBeNull();

        fsm.SetData<number>("count", 3);
        expect(fsm.HasData("count")).toBe(true);
        expect(fsm.GetData<number>("count")).toBe(3);

        fsm.SetData<number>("count", 5);
        expect(fsm.GetData<number>("count")).toBe(5);

        // 空字符串是合法数据值,不得被误判为不存在
        fsm.SetData<string>("name", "");
        expect(fsm.GetData<string>("name")).toBe("");

        expect(fsm.RemoveData("count")).toBe(true);
        expect(fsm.HasData("count")).toBe(false);
        expect(fsm.RemoveData("count")).toBe(false);

        expect(() => fsm.SetData<number>("", 1)).toThrow("Data name is invalid.");
        expect(() => fsm.GetData<number>("")).toThrow("Data name is invalid.");
    });

    it("Reset 离开当前状态(非关闭)、清空 BlackBoard 且可重新 Start", () => {
        const idle = new StateIdle();
        const fsm = Fsm.Create("main", new Owner(), [idle, new StateRun()]);
        fsm.Start(StateIdle);
        fsm.SetData("count", 3);

        fsm.Reset();

        expect(idle.events).toContain("Idle:OnLeave:false");
        expect(fsm.IsRunning).toBe(false);
        expect(fsm.HasData("count")).toBe(false);

        fsm.Start(StateIdle);
        expect(idle.events.filter((e) => e === "Idle:OnEnter")).toHaveLength(2);
    });

    it("shutdown 清理:OnLeave(true) + 全部 OnDestroy,之后 update 无副作用", () => {
        const idle = new StateIdle();
        const fsm = Fsm.Create("main", new Owner(), [idle, new StateRun()]);
        fsm.Start(StateIdle);

        fsm.shutdown();

        expect(idle.events).toEqual(["Idle:OnInit", "Idle:OnEnter", "Idle:OnLeave:true", "Idle:OnDestroy"]);
        expect(fsm.IsDestroyed).toBe(true);
        expect(fsm.IsRunning).toBe(false);
        expect(() => fsm.update(1, 1)).not.toThrow();
    });

    it("错误契约:非法创建/启动/切状态/增删状态", () => {
        const owner = new Owner();
        expect(() => Fsm.Create("x", null as unknown as Owner, [new StateIdle()])).toThrow("FSM owner is invalid.");
        expect(() => Fsm.Create("x", owner, [])).toThrow("FSM states is invalid.");

        const fsm = Fsm.Create("x", owner, [new StateIdle()]);
        expect(() => fsm.Start(StateA)).toThrow("can not start state");
        fsm.Start(StateIdle);
        expect(() => fsm.Start(StateIdle)).toThrow("can not start again");

        const onlyA = Fsm.Create("y", owner, [new StateA()]);
        onlyA.Start(StateA);
        expect(() => onlyA.update(1, 1)).toThrow("can not change state to");

        expect(() => fsm.AddState(new StateIdle())).toThrow("is already exist");
        expect(() => fsm.RemoveState(StateIdle)).toThrow("can not remove current state");
    });

    it("FsmManager:CreateFsm 注册、HasFsm/GetFsm/Count/GetAllFsms、销毁清理", () => {
        const manager = new FsmManager();
        const owner = new Owner();
        const fsm = manager.CreateFsm("f1", owner, [new StateIdle(), new StateRun()]);

        expect(manager.Count).toBe(1);
        expect(manager.HasFsm(Owner, "f1")).toBe(true);
        expect(manager.HasFsm(Owner, "f2")).toBe(false);
        expect(manager.GetFsm(Owner, "f1")).toBe(fsm);
        expect(manager.GetFsm(Owner, "missing")).toBeNull();
        expect(manager.GetAllFsms()).toEqual([fsm]);

        expect(() => manager.CreateFsm("f1", owner, [new StateIdle()])).toThrow("is already exist");

        manager.CreateFsm("f2", owner, [new StateIdle()]);
        expect(manager.Count).toBe(2);

        expect(manager.DestroyFsm(Owner, "f1")).toBe(true);
        expect(manager.HasFsm(Owner, "f1")).toBe(false);
        expect(fsm.IsDestroyed).toBe(true);
        expect(manager.DestroyFsm(Owner, "f1")).toBe(false);

        const fsm2 = manager.GetFsm(Owner, "f2");
        expect(fsm2).not.toBeNull();
        expect(manager.DestroyFsmByInstance(fsm2 as Fsm<Owner>)).toBe(true);
        expect(manager.Count).toBe(0);
    });

    it("FsmManager.update(dt) 驱动注册的状态机;shutdown 清理全部", () => {
        const manager = new FsmManager();
        const fsm = manager.CreateFsm("f1", new Owner(), [new StateIdle(), new StateRun()]);
        fsm.Start(StateIdle);

        manager.update(0.5);

        expect(fsm.CurrentStateTime).toBeCloseTo(0.5, 10);
        expect(fsm.GetData<number>("idleElapsed")).toBeCloseTo(0.5, 10);

        manager.shutdown();
        expect(manager.Count).toBe(0);
        expect(fsm.IsDestroyed).toBe(true);
    });
});
