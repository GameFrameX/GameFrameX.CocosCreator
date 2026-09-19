import UIForm from "../../gameframex/ui/UIForm";
import Log from "../../gameframex/base/Log";
import PlayerManager from "../manager/PlayerManager";

/**
 * 主界面视图契约(引擎无关)。
 */
export interface IUIMainView {
    /** 展示玩家信息(名称/等级) */
    setPlayer(text: string): void;
}

/**
 * 主界面(对照 Unity UIMain;Phase 6 最小实现:玩家信息展示。
 * 背包/RPS 入口等随对应 Manager 移植逐步接入)。
 */
export default class UIMain extends UIForm {
    public static viewResolver: ((root: unknown) => IUIMainView | null) | null = null;

    private _view: IUIMainView | null = null;

    public LoadData(): void {
        this._view = UIMain.viewResolver?.(this.VisualRoot) ?? null;
        if (!this._view) {
            Log.warn("UIMain", "视图未解析(viewResolver 未注入)");
            return;
        }
        const info = PlayerManager.instance.PlayerInfo;
        this._view.setPlayer(`玩家:${info?.Name ?? "?"}  Lv.${info?.Level ?? 1}`);
    }
}
