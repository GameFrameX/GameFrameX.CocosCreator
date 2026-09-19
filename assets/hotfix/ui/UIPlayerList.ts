import UIForm from "../../gameframex/ui/UIForm";
import Log from "../../gameframex/base/Log";
import GameApp from "../../gameframex/GameApp";
import AccountManager from "../manager/AccountManager";
import PlayerManager from "../manager/PlayerManager";
import PlayerService from "../manager/PlayerService";

/**
 * 角色列表视图契约(引擎无关;引擎绑定由 View 组件/测试 mock 实现)。
 */
export interface IPlayerListView {
    /** 展示角色列表(空列表显示引导文案) */
    setPlayers(names: string[]): void;
    /** 注册"进入游戏"(选中角色后)回调 */
    onEnterGame(handler: () => void): void;
    /** 注册"创建角色"回调 */
    onCreatePlayer(handler: () => void): void;
    setStatus(text: string): void;
}

export default class UIPlayerList extends UIForm {
    public static viewResolver: ((root: unknown) => IPlayerListView | null) | null = null;

    private _view: IPlayerListView | null = null;

    public LoadData(): void {
        this._view = UIPlayerList.viewResolver?.(this.VisualRoot) ?? null;
        if (!this._view) {
            Log.warn("UIPlayerList", "视图未解析(viewResolver 未注入)");
            return;
        }
        this._view.setPlayers(AccountManager.instance.PlayerList.map((p) => `${p.Name}(Lv.${p.Level})`));
        this._view.onEnterGame(() => void this.enterGame());
        this._view.onCreatePlayer(() => void this.createPlayer());
    }

    /** 进入游戏:ReqPlayerLogin(选择角色)→ PlayerManager 缓存 → OpenAsync UIMain */
    private async enterGame(): Promise<void> {
        try {
            this._view?.setStatus("进入游戏…");
            await this.playerService().loginPlayer(AccountManager.instance.SelectedPlayerId);
            await GameApp.UI.OpenAsync("UIMain");
        } catch (error) {
            this._view?.setStatus(`异常:${error instanceof Error ? error.message : String(error)}`);
            Log.error("UIPlayerList", "进入游戏异常", error);
        }
    }

    /** 创建角色:ReqPlayerCreate → 自动登录 → OpenAsync UIMain */
    private async createPlayer(): Promise<void> {
        try {
            this._view?.setStatus("创建角色…");
            await this.playerService().createAndLogin(AccountManager.instance.AccountId, `player${Date.now() % 100000}`);
            await GameApp.UI.OpenAsync("UIMain");
        } catch (error) {
            this._view?.setStatus(`异常:${error instanceof Error ? error.message : String(error)}`);
            Log.error("UIPlayerList", "创建角色异常", error);
        }
    }

    /** PlayerService 实例(依赖 GameApp.Network 与两个 Manager) */
    private playerService(): PlayerService {
        return new PlayerService({ network: GameApp.Network, playerManager: PlayerManager.instance, accountManager: AccountManager.instance });
    }
}


