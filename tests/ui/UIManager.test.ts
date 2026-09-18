import { describe, expect, it } from "vitest";
import type { IUIFormTransition } from "../../assets/gameframex/ui/UIManager";
import UIManager from "../../assets/gameframex/ui/UIManager";
import { MockFormHelper, PauseCoverForm, PopupForm, RecordingForm } from "./support";

/** 创建挂好 Mock 后端的管理器,注册 Normal 组 FormA/FormB/FormC、Popup 组 FormP、暂停覆盖者 FormS */
function createManager(): { manager: UIManager; helper: MockFormHelper } {
    const helper = new MockFormHelper();
    helper.register("FormA", () => new RecordingForm());
    helper.register("FormB", () => new RecordingForm());
    helper.register("FormC", () => new RecordingForm());
    helper.register("FormP", () => new PopupForm());
    helper.register("FormS", () => new PauseCoverForm());
    const manager = new UIManager(helper);
    return { manager, helper };
}

/** 记录 show/hide 调用的过渡插槽 */
class RecordingTransition implements IUIFormTransition {
    public readonly shown: string[] = [];
    public readonly hidden: string[] = [];

    public show(form: RecordingForm): void {
        this.shown.push(form.UIFormAssetName);
    }

    public hide(form: RecordingForm): void {
        this.hidden.push(form.UIFormAssetName);
    }
}

/**
 * UIManager 遮挡语义(与 Unity UIGroup.Refresh/RemoveUIForm 一致):
 * 被覆盖 → OnCover;覆盖者 PauseCoveredUIForm → 叠加 OnPause;
 * 覆盖者关闭 → OnResume(曾暂停时)→ OnReveal;关闭中窗体自身 OnCover→OnPause→OnClose。
 */
describe("UIManager 遮挡语义与组管理", () => {
    it("init 注册 Normal/Popup/Fixed 三组,深度 0/1/2;重复 AddUIGroup 返回 false", async () => {
        const { manager } = createManager();
        expect(manager.UIGroupCount).toBe(0);

        await manager.init();

        expect(manager.UIGroupCount).toBe(3);
        expect(manager.HasUIGroup("Normal")).toBe(true);
        expect(manager.HasUIGroup("Popup")).toBe(true);
        expect(manager.HasUIGroup("Fixed")).toBe(true);
        expect(manager.GetUIGroup("Normal")!.Depth).toBe(0);
        expect(manager.GetUIGroup("Popup")!.Depth).toBe(1);
        expect(manager.GetUIGroup("Fixed")!.Depth).toBe(2);
        expect(manager.AddUIGroup("Normal", 9)).toBe(false);
        expect(manager.AddUIGroup("Tip", 3)).toBe(true);
        expect(manager.GetAllUIGroups()).toHaveLength(4);
    });

    it("PauseCoveredUIForm 覆盖:被覆盖窗体 OnCover→OnPause 且失活;覆盖者关闭后 OnResume→OnReveal 复活", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");

        const s = await manager.OpenAsync<RecordingForm>("FormS");
        expect(a.calls.slice(-2)).toEqual(["OnCover", "OnPause"]);
        expect(a.Available).toBe(false);
        expect(s.calls).not.toContain("OnCover");

        manager.Close("FormS");
        expect(a.calls.slice(-2)).toEqual(["OnResume", "OnReveal"]);
        expect(a.Available).toBe(true);
    });

    it("普通覆盖:被覆盖窗体仅 OnCover 不 OnPause;覆盖者关闭后仅 OnReveal", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");

        await manager.OpenAsync<RecordingForm>("FormB");
        expect(a.calls.filter((name) => name === "OnCover" || name === "OnPause")).toEqual(["OnCover"]);
        expect(a.Available).toBe(true);

        manager.Close("FormB");
        expect(a.calls.filter((name) => name === "OnResume" || name === "OnReveal")).toEqual(["OnReveal"]);
    });

    it("Close 释放路径:关闭中窗体自身 OnCover→OnPause→OnClose,后端 release 一次,重复 Close 幂等", async () => {
        const { manager, helper } = createManager();
        await manager.init();
        const b = await manager.OpenAsync<RecordingForm>("FormB");

        manager.Close(b);

        expect(b.calls).toEqual(["OnAwake", "OnInit", "OnOpen", "BindEvent", "LoadData", "UpdateLocalization", "OnCover", "OnPause", "OnClose"]);
        expect(b.closeArgs).toEqual([{ isShutdown: false, userData: null }]);
        expect(b.Available).toBe(false);
        expect(b.UIGroup).toBeNull();
        expect(helper.released).toEqual([b]);
        expect(manager.GetUIForm("FormB")).toBeNull();
        expect(manager.HasUIForm("FormB")).toBe(false);

        manager.Close("FormB");
        manager.Close(b);
        expect(helper.released).toHaveLength(1);
        expect(b.calls.filter((name) => name === "OnClose")).toHaveLength(1);
    });

    it("组内层级递增:后打开的窗体 DepthInUIGroup 更大,CurrentUIForm 为最新", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        const b = await manager.OpenAsync<RecordingForm>("FormB");
        const c = await manager.OpenAsync<RecordingForm>("FormC");

        const group = manager.GetUIGroup("Normal")!;
        expect(c.DepthInUIGroup).toBe(3);
        expect(b.DepthInUIGroup).toBe(2);
        expect(a.DepthInUIGroup).toBe(1);
        expect(group.CurrentUIForm).toBe(c);
        expect(group.UIFormCount).toBe(3);

        manager.Close("FormC");
        expect(b.DepthInUIGroup).toBe(2);
        expect(a.DepthInUIGroup).toBe(1);
        expect(group.CurrentUIForm).toBe(b);
    });

    it("不同组的窗体互不遮挡", async () => {
        const { manager, helper } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");

        await manager.OpenAsync<RecordingForm>("FormP");

        expect(a.calls.filter((name) => name === "OnCover" || name === "OnPause")).toEqual([]);
        expect(helper.groupAssignments[helper.groupAssignments.length - 1]).toEqual({ formKey: "FormP", groupName: "Popup" });
    });

    it("RefocusUIForm:被覆盖窗体移回顶部,OnRefocus 恰好一次,原顶窗体被 OnCover", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        const b = await manager.OpenAsync<RecordingForm>("FormB");

        manager.RefocusUIForm(a, { id: 9 });

        expect(a.calls.filter((name) => name === "OnRefocus")).toHaveLength(1);
        expect(a.receivedUserData[a.receivedUserData.length - 1]).toEqual({ id: 9 });
        expect(a.calls).toContain("OnReveal");
        expect(b.calls.filter((name) => name === "OnCover")).toHaveLength(1);
        expect(a.DepthInUIGroup).toBe(2);
        expect(b.DepthInUIGroup).toBe(1);
    });

    it("update(dt) 驱动未暂停窗体 OnUpdate;被暂停窗体不更新", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        const s = await manager.OpenAsync<RecordingForm>("FormS");

        manager.update(0.016);

        expect(s.calls.filter((name) => name.startsWith("OnUpdate:"))).toEqual(["OnUpdate:0.016:0.016"]);
        expect(a.calls.filter((name) => name.startsWith("OnUpdate:"))).toEqual([]);
    });

    it("组暂停:UIGroup.Pause 暂停组内全部窗体,恢复时 OnResume→OnReveal", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        const group = manager.GetUIGroup("Normal")!;

        group.Pause = true;
        expect(a.calls.slice(-2)).toEqual(["OnCover", "OnPause"]);

        group.Pause = false;
        expect(a.calls.slice(-2)).toEqual(["OnResume", "OnReveal"]);
    });

    it("CloseUIGroup 关闭组内全部窗体", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        const b = await manager.OpenAsync<RecordingForm>("FormB");
        await manager.OpenAsync<RecordingForm>("FormP");

        manager.CloseUIGroup("Normal");

        expect(a.calls.filter((name) => name === "OnClose")).toHaveLength(1);
        expect(b.calls.filter((name) => name === "OnClose")).toHaveLength(1);
        expect(manager.HasUIForm("FormA")).toBe(false);
        expect(manager.HasUIForm("FormB")).toBe(false);
        expect(manager.HasUIForm("FormP")).toBe(true);
    });

    it("shutdown 以 isShutdown=true 关闭全部窗体并清空组", async () => {
        const { manager } = createManager();
        await manager.init();
        const a = await manager.OpenAsync<RecordingForm>("FormA");
        await manager.OpenAsync<RecordingForm>("FormP");

        manager.shutdown();

        expect(a.closeArgs).toEqual([{ isShutdown: true, userData: null }]);
        expect(manager.GetAllLoadedUIForms()).toEqual([]);
        expect(manager.UIGroupCount).toBe(0);
    });

    it("并发 OpenAsync 同 formKey 共享同一次加载,返回同一实例", async () => {
        const { manager, helper } = createManager();
        await manager.init();
        helper.holdLoad();

        const p1 = manager.OpenAsync("FormA");
        const p2 = manager.OpenAsync("FormA");
        helper.releaseLoadGate();
        const [f1, f2] = await Promise.all([p1, p2]);

        expect(f1).toBe(f2);
        expect(helper.loadCount).toBe(1);
    });

    it("过渡插槽:打开后 show、关闭前 hide 各触发一次;默认空实现不影响生命周期", async () => {
        const { manager } = createManager();
        await manager.init();
        const transition = new RecordingTransition();
        manager.SetTransition(transition);

        await manager.OpenAsync<RecordingForm>("FormA");
        manager.Close("FormA");

        expect(transition.shown).toEqual(["FormA"]);
        expect(transition.hidden).toEqual(["FormA"]);
    });
});
