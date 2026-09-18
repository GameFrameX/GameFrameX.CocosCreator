import { _decorator, Component, Label, Node } from "cc";
import GameEntry from "../../../gameframex/GameEntry";

const { ccclass } = _decorator;

/**
 * 模块驱动组件(spec §1:Launcher 场景常驻节点,唯一帧驱动源)。
 *
 * 契约:onLoad 挂接帧循环;update 透传 dt 至 GameEntry.updateAll;onDestroy 逆序关闭全部模块。
 * 开发期自证:左上角调试 Label 显示帧计数与模块注册状态(编辑器/小游戏包冒烟的可视证据;
 * 发布构建由 ENABLE_WECHAT_MINI_GAME 之外的裁剪决策处理,Phase 7 收口)。
 */
@ccclass("GameEntryComponent")
export default class GameEntryComponent extends Component {
    private _frame = 0;
    private _label: Label | null = null;

    protected onLoad(): void {
        console.log("[GameFrameX] GameEntryComponent 驱动接通");
        reportStage("GameEntryComponent.onLoad", "");
        const labelNode = new Node("GFX_DEBUG_LABEL");
        labelNode.layer = this.node.layer;
        labelNode.setPosition(0, 0, 0);
        this.node.parent?.addChild(labelNode);
        this._label = labelNode.addComponent(Label);
        this._label.fontSize = 64;
        this._label.color.set(255, 40, 40, 255);
        this._label.string = "GFX booting…";
    }

    protected update(dt: number): void {
        try {
            GameEntry.updateAll(dt);
        } catch (error) {
            const doc = (globalThis as Record<string, unknown>).document as { documentElement: { setAttribute(n: string, v: string): void } } | undefined;
            doc?.documentElement.setAttribute("data-gfx-err", (error instanceof Error ? `${error.message} || ${error.stack}` : String(error)).slice(0, 900));
            this.setTitle("GFX-ERR");
            return;
        }
        this._frame++;
        if (this._frame <= 3 || this._frame % 60 === 0) {
            this.setTitle(`GFX-${this._frame}-mods-${GameEntry.moduleCount}`);
        }
        if (this._label && this._frame % 30 === 0) {
            this._label.string = `GFX frames:${this._frame} modules:${GameEntry.moduleCount} net:${GameEntry.hasModule("Network") ? "on" : "off"}`;
        }
    }

    /** 一次性诊断(验证后撤):web 环境用 document.title 暴露帧状态 */
    private setTitle(text: string): void {
        const doc = (globalThis as Record<string, unknown>).document as { title: string } | undefined;
        if (doc) {
            doc.title = text;
        }
    }

    protected onDestroy(): void {
        GameEntry.shutdownAll();
    }
}

/** 一次性诊断插桩(验证后撤):各阶段上报本地监听器 http://127.0.0.1:39999 */
export function reportStage(stage: string, detail: unknown): void {
    try {
        const wxApi = (globalThis as Record<string, unknown>).wx as { request(options: { url: string; method: string; data: string }): void } | undefined;
        if (wxApi) {
            wxApi.request({ url: "http://127.0.0.1:39999/report", method: "POST", data: stage + " | " + String(detail) });
        }
    } catch (error) {
        console.log("[report] fail", error);
    }
}
