import Log from "../../gameframex/base/Log";
import { User } from "../../gameframex/protobuf/_0300_User";
import type PlayerManager from "./PlayerManager";
import type AccountManager from "./AccountManager";

/** 玩家信息(proto PlayerInfo 字段子集) */
export interface PlayerInfoLite {
    Id: number;
    Name: string;
    Level: number;
}

/** 网络配对调用抽象(引擎侧=GameApp.Network;测试=记录式 stub) */
export interface IRpcCaller {
    call(message: unknown): Promise<unknown>;
}

/** 依赖注入 */
export interface PlayerServiceDeps {
    network: IRpcCaller;
    playerManager: PlayerManager;
    accountManager: AccountManager;
}

/**
 * 玩家流程服务(引擎无关):创建角色 / 角色登录,统一 RPC 与错误码处理。
 *
 * 契约:ErrorCode>0 以异常上抛(消息含错误码);成功返回 PlayerInfo 并写入 PlayerManager 缓存。
 */
export default class PlayerService {
    private readonly _network: IRpcCaller;
    private readonly _playerManager: PlayerManager;
    private readonly _accountManager: AccountManager;

    constructor(deps: PlayerServiceDeps) {
        this._network = deps.network;
        this._playerManager = deps.playerManager;
        this._accountManager = deps.accountManager;
    }

    /** 创建角色并立即登录(返回最终玩家信息) */
    public async createAndLogin(accountId: number, name: string): Promise<PlayerInfoLite> {
        const create = new User.ReqPlayerCreate();
        create.Id = accountId;
        create.Name = name;
        const created = (await this.call(create)) as { PlayerInfo?: { Id: number } };
        return this.loginPlayer(created.PlayerInfo?.Id ?? 0);
    }

    /** 角色登录(选择角色) */
    public async loginPlayer(playerId: number): Promise<PlayerInfoLite> {
        const login = new User.ReqPlayerLogin();
        login.Id = playerId;
        const resp = (await this.call(login)) as { PlayerInfo?: PlayerInfoLite };
        const playerInfo = resp.PlayerInfo ?? { Id: playerId, Name: "", Level: 0 };
        this._playerManager.PlayerInfo = playerInfo;
        return playerInfo;
    }

    /** RPC + ErrorCode 检查(>0 抛错,消息含错误码;decode 产物为字段浅拷贝) */
    private async call(message: unknown): Promise<unknown> {
        const resp = (await this._network.call(message)) as unknown as Record<string, unknown>;
        const code = resp.ErrorCode;
        if (typeof code === "number" && code > 0) {
            throw new Error(`RPC 错误码 ${code}`);
        }
        return resp;
    }
}
