import { _decorator, Button, Component, Label } from "cc";
import type { ILoginView } from "../../../hotfix/ui/UILogin";

const { ccclass, property } = _decorator;

/**
 * UILogin 引擎绑定(Prefab 根组件;对照 Unity 的生成绑定 partial)。
 *
 * 契约:实现 ILoginView 引擎无关视图契约——status 文案与登录点击;
 * UILogin 逻辑层经 viewResolver(VisualRoot.getComponent)取得本组件,零引擎依赖。
 */
@ccclass("UILoginView")
export default class UILoginView extends Component implements ILoginView {
    @property({ type: Label, tooltip: "状态文案" })
    public statusLabel: Label | null = null;

    @property({ type: Button, tooltip: "登录按钮" })
    public loginButton: Button | null = null;

    public setStatus(text: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
    }

    public onLoginButton(handler: () => void): void {
        this.loginButton?.node.on(Button.EventType.CLICK, handler);
    }
}
