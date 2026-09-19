import UIForm from "../../gameframex/ui/UIForm";
import Log from "../../gameframex/base/Log";
import GameApp from "../../gameframex/GameApp";
import { User } from "../../gameframex/protobuf/_0300_User";
import AccountManager, { type PlayerInfoLite } from "../manager/AccountManager";
import PlayerManager from "../manager/PlayerManager";

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

    /** 进入游戏:ReqPlayerLogin(选择角色)→ RespPlayerLogin → PlayerManager 缓存 → 进 UIMain */
    private async enterGame(): Promise<void> {
        try {
            this._view?.setStatus("进入游戏…");
            const req = new User.ReqPlayerLogin();
            req.Id = AccountManager.instance.SelectedPlayerId;
            // decode 产物为字段浅拷贝;MessageObject→unknown→Record 的边界转换(生成物无索引签名)
            const resp = (await GameApp.Network.call(req)) as unknown as Record<string, unknown>;
            if (respError(resp)) {
                this._view?.setStatus(`进入失败:错误码 ${respError(resp)}`);
                return;
            }
            await openMain(resp);
        } catch (error) {
            this._view?.setStatus(`异常:${error instanceof Error ? error.message : String(error)}`);
            Log.error("UIPlayerList", "进入游戏异常", error);
        }
    }

    /** 创建角色:ReqPlayerCreate → RespPlayerCreate → 直接登录进 UIMain */
    private async createPlayer(): Promise<void> {
        try {
            this._view?.setStatus("创建角色…");
            const req = new User.ReqPlayerCreate();
            req.Id = AccountManager.instance.AccountId;
            req.Name = `player${Date.now() % 100000}`;
            // decode 产物为字段浅拷贝;MessageObject→unknown→Record 的边界转换(生成物无索引签名)
            const resp = (await GameApp.Network.call(req)) as unknown as Record<string, unknown>;
            if (respError(resp)) {
                this._view?.setStatus(`创建失败:错误码 ${respError(resp)}`);
                return;
            }
            await loginCreated(resp);
        } catch (error) {
            this._view?.setStatus(`异常:${error instanceof Error ? error.message : String(error)}`);
            Log.error("UIPlayerList", "创建角色异常", error);
        }
    }
}

/** 打开主界面并缓存玩家信息 */
async function openMain(resp: Record<string, unknown>): Promise<void> {
    const playerInfo = resp.PlayerInfo as PlayerInfoLite | undefined;
    if (playerInfo) {
        PlayerManager.instance.PlayerInfo = playerInfo;
    }
    Log.info("UIPlayerList", `进入 UIMain(玩家 ${playerInfo?.Name ?? "?"})`);
}

/** 创建后立即登录 */
async function loginCreated(resp: Record<string, unknown>): Promise<void> {
    const playerInfo = resp.PlayerInfo as { Id: number } | undefined;
    const req = new User.ReqPlayerLogin();
    req.Id = playerInfo?.Id ?? 0;
    const respLogin = (await GameApp.Network.call(req)) as unknown as Record<string, unknown>;
    await openMain(respLogin);
}

/** Resp 错误码读取(decode 产物为字段浅拷贝,in 守卫收窄) */
function respError(message: Record<string, unknown>): number {
    const code = message.ErrorCode;
    return typeof code === "number" ? code : 0;
}
