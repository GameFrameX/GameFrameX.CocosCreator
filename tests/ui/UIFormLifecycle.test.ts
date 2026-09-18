import { describe, expect, it } from "vitest";
import UIManager from "../../assets/gameframex/ui/UIManager";
import { MockFormHelper, PauseCoverForm, RecordingForm } from "./support";

/** 创建挂好 Mock 后端的管理器,注册 FormA(普通)/FormB(暂停覆盖者) */
function createManager(): { manager: UIManager; helper: MockFormHelper } {
    const helper = new MockFormHelper();
    helper.register("FormA", () => new RecordingForm());
    helper.register("FormB", () => new PauseCoverForm());
    const manager = new UIManager(helper);
    return { manager, helper };
}

/**
 * UIForm 生命周期契约(spec §3.1,与 Unity UIForm.cs 同名同参):
 * OnAwake(创建一次)→ OnInit → OnOpen(userData)→ BindEvent(每开关周期一次)→ LoadData → UpdateLocalization;
 * OnClose(isShutdown, userData);重复打开同实例不重复 OnAwake/BindEvent。
 */
describe("UIForm 生命周期顺序与幂等", () => {
    it("首次打开触发 OnAwake→OnInit→OnOpen→BindEvent→LoadData→UpdateLocalization,后端调用序 load→instantiate→addToGroup", async () => {
        const { manager, helper } = createManager();
        await manager.init();

        const form = await manager.OpenAsync<RecordingForm>("FormA", { id: 1 });

        expect(form.calls).toEqual(["OnAwake", "OnInit", "OnOpen", "BindEvent", "LoadData", "UpdateLocalization"]);
        expect(form.receivedUserData).toEqual([{ id: 1 }]);
        expect(form.Available).toBe(true);
        expect(form.Visible).toBe(true);
        expect(form.UIFormAssetName).toBe("FormA");
        expect(form.SerialId).toBeGreaterThan(0);
        expect(helper.calls).toEqual(["load:FormA", "instantiate", "addToGroup:Normal"]);
        expect(helper.groupAssignments).toEqual([{ formKey: "FormA", groupName: "Normal" }]);
    });

    it("重复 OpenAsync 同 formKey:返回既有实例,不重复 OnAwake/OnInit/OnOpen/BindEvent,触发 OnRefocus 携带新 userData", async () => {
        const { manager, helper } = createManager();
        await manager.init();
        const first = await manager.OpenAsync<RecordingForm>("FormA");

        const second = await manager.OpenAsync<RecordingForm>("FormA", { id: 2 });

        expect(second).toBe(first);
        const lifecycleCalls = first.calls.filter((name) =>
            name === "OnAwake" || name === "OnInit" || name === "OnOpen" || name === "BindEvent" || name === "LoadData",
        );
        expect(lifecycleCalls).toEqual(["OnAwake", "OnInit", "OnOpen", "BindEvent", "LoadData"]);
        expect(first.calls.filter((name) => name === "OnRefocus")).toHaveLength(1);
        expect(first.receivedUserData[first.receivedUserData.length - 1]).toEqual({ id: 2 });
        expect(helper.loadCount).toBe(1);
    });

    it("Close 后重新打开:旧实例被后端释放,新实例重新走完整生命周期", async () => {
        const { manager, helper } = createManager();
        await manager.init();
        const first = await manager.OpenAsync<RecordingForm>("FormA");

        manager.Close("FormA");
        const second = await manager.OpenAsync<RecordingForm>("FormA");

        expect(second).not.toBe(first);
        expect(helper.released).toEqual([first]);
        expect(second.calls).toEqual(["OnAwake", "OnInit", "OnOpen", "BindEvent", "LoadData", "UpdateLocalization"]);
        expect(manager.GetUIForm("FormA")).toBe(second);
    });

    it("Toggle 开关:未打开→打开返回 true;已打开→关闭返回 false", async () => {
        const { manager } = createManager();
        await manager.init();

        expect(await manager.Toggle("FormA")).toBe(true);
        expect(manager.HasUIForm("FormA")).toBe(true);
        expect(await manager.Toggle("FormA")).toBe(false);
        expect(manager.HasUIForm("FormA")).toBe(false);
        expect(await manager.Toggle("FormA")).toBe(true);
        expect(manager.HasUIForm("FormA")).toBe(true);
    });

    it("UIForm 状态标记防重复驱动:重复 awake/open/close 幂等,关闭周期结束后 BindEvent 重新允许", () => {
        const form = new RecordingForm();
        form.internalInit(7, "FormX");
        form.internalAwake();
        form.internalAwake();
        form.internalOpen(null);
        form.internalOpen(null);
        form.internalClose(false, null);
        form.internalClose(false, null);

        expect(form.calls).toEqual(["OnInit", "OnAwake", "OnOpen", "BindEvent", "LoadData", "UpdateLocalization", "OnClose"]);
        expect(form.SerialId).toBe(7);

        form.internalOpen(null);
        expect(form.calls.filter((name) => name === "BindEvent")).toHaveLength(2);
    });
});
