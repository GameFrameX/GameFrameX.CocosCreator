import { _decorator, Button, Component, Label } from "cc";
import type { IPlayerListView } from "../../../hotfix/ui/UIPlayerList";

const { ccclass, property } = _decorator;

/**
 * UIPlayerList 引擎绑定(Prefab 根组件)。
 */
@ccclass("UIPlayerListView")
export default class UIPlayerListView extends Component implements IPlayerListView {
    @property({ type: Label, tooltip: "角色列表文案" })
    public playersLabel: Label | null = null;

    @property({ type: Label, tooltip: "状态文案" })
    public statusLabel: Label | null = null;

    @property({ type: Button, tooltip: "进入游戏按钮" })
    public enterButton: Button | null = null;

    @property({ type: Button, tooltip: "创建角色按钮" })
    public createButton: Button | null = null;

    public setPlayers(names: string[]): void {
        if (this.playersLabel) {
            this.playersLabel.string = names.length > 0 ? `角色:${names.join("、")}` : "暂无角色,请点击「创建角色」";
        }
    }

    public setStatus(text: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
    }

    public onEnterGame(handler: () => void): void {
        this.enterButton?.node.on(Button.EventType.CLICK, handler);
    }

    public onCreatePlayer(handler: () => void): void {
        this.createButton?.node.on(Button.EventType.CLICK, handler);
    }
}
