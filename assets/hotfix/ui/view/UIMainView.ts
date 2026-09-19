import { _decorator, Component, Label } from "cc";
import type { IUIMainView } from "../../../hotfix/ui/UIMain";

const { ccclass, property } = _decorator;

/**
 * UIMain 引擎绑定(Prefab 根组件)。
 */
@ccclass("UIMainView")
export default class UIMainView extends Component implements IUIMainView {
    @property({ type: Label, tooltip: "玩家信息" })
    public playerLabel: Label | null = null;

    public setPlayer(text: string): void {
        if (this.playerLabel) {
            this.playerLabel.string = text;
        }
    }
}
