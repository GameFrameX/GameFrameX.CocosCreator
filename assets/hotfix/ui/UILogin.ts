import GameApp from "../../gameframex/GameApp";
import Log from "../../gameframex/base/Log";
import UIForm from "../../gameframex/ui/UIForm";
import EventName from "../../gameframex/event/EventName";
import { User } from "../../gameframex/protobuf/_0300_User";

/**
 * 登录界面视图契约(引擎无关;Cocos 绑定由 UILoginView 实现,测试注入 mock)。
 */
export interface ILoginView {
    /** 更新状态文案(连接中/登录中/结果) */
    setStatus(text: string): void;
    /** 注册登录按钮点击回调 */
    onLoginButton(handler: () => void): void;
}

/** 登录服务器地址(本地联调;正式环境走 GlobalConfig/ServerList,Phase 6 接入) */
const LOGIN_HOST = "127.0.0.1";
const LOGIN_PORT = 39110;

/**
 * 登录界面(对照 Unity Hotfix/UI/Logic/UILogin/UILogin.cs;差异:Unity 走 HTTP 登录,
 * Cocos 契约为 WS 全链路(spec §1 目标段)——登录/角色列表均走 GameApp.Network.call RPC)。
 *
 * 流程:点击登录 → 确保 WS 连接 → ReqLogin → ReqPlayerList → 状态展示;
 * UIPlayerList/UIPlayerCreate(Phase 6)落地前仅展示结果,不阻断。
 */
export default class UILogin extends UIForm {
    /** 视图解析器(引擎绑定注入;测试注入 mock) */
    public static viewResolver: ((root: unknown) => ILoginView | null) | null = null;

    private _view: ILoginView | null = null;

    public OnAwake(): void {
        Log.info("UILogin", "OnAwake");
    }

    public BindEvent(): void {
        this._view = UILogin.viewResolver?.(this.VisualRoot) ?? null;
        this._view?.onLoginButton(() => {
            void this.login();
        });
    }

    public LoadData(): void {
        this._view?.setStatus(" Ready ");
    }

    private async login(): Promise<void> {
        try {
            this.setStatus("连接服务器…");
            await this.ensureConnected();

            this.setStatus("登录中…");
            const req = new User.ReqLogin();
            req.UserName = "cocos-player";
            req.Platform = "cocos";
            req.SdkType = 0;
            req.SdkToken = "";
            req.Device = "cocos-web";
            const respLogin = await GameApp.Network.call(req);
            const login = readLoginResult(respLogin);
            if (login.Code > 0) {
                this.setStatus(`登录失败:错误码 ${login.Code}`);
                return;
            }

            this.setStatus("获取角色列表…");
            const reqList = new User.ReqPlayerList();
            reqList.Id = login.Id;
            const respList = await GameApp.Network.call(reqList);
            const players = readPlayerList(respList);
            if (players.errorCode > 0) {
                this.setStatus(`角色列表失败:错误码 ${players.errorCode}`);
                return;
            }

            this.setStatus(`登录成功(${login.Id})角色 ${players.count} 个`);
            await GameApp.UI.OpenAsync("UIPlayerList");
            GameApp.UI.Close(this);
        } catch (error) {
            this.setStatus(`异常:${error instanceof Error ? error.message : String(error)}`);
            Log.error("UILogin", "登录链异常", error);
        }
    }

    /** 确保 WS 已连接(未连接则发起并等待 SocketConnected 一次) */
    private async ensureConnected(): Promise<void> {
        if (GameApp.Network.isConnected) {
            return;
        }
        const events = GameApp.Event;
        GameApp.Network.connect(LOGIN_HOST, LOGIN_PORT);
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                events.off(EventName.SocketConnected, onConnected);
                reject(new Error("连接超时(10s)"));
            }, 10000);
            const onConnected = (): void => {
                clearTimeout(timer);
                events.off(EventName.SocketConnected, onConnected);
                resolve();
            };
            events.on(EventName.SocketConnected, onConnected);
        });
    }

    private setStatus(text: string): void {
        this._view?.setStatus(text);
    }
}

/** 读取 RespLogin 结果(Code/Id;decode 产物为字段浅拷贝,经 in 守卫收窄) */
function readLoginResult(message: unknown): { Code: number; Id: number } {
    const record = message as Record<string, unknown>;
    return {
        Code: typeof record.Code === "number" ? record.Code : 0,
        Id: typeof record.Id === "number" ? record.Id : 0,
    };
}

/** 读取 RespPlayerList(ErrorCode + PlayerList 数量;repeated 字段经 fake/真实 decode 均为数组) */
function readPlayerList(message: unknown): { errorCode: number; count: number } {
    const record = message as Record<string, unknown>;
    const list = record.PlayerList;
    return {
        errorCode: typeof record.ErrorCode === "number" ? record.ErrorCode : 0,
        count: Array.isArray(list) ? list.length : list != null ? 1 : 0,
    };
}
