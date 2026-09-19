/**
 * 账号管理器(对照 Unity Hotfix/Manager/AccountManager 同名职责,引擎无关)。
 *
 * 契约:登录账号 Id、角色列表缓存、当前选择角色 Id;进程内单例(经 Singleton)。
 */
import Singleton from "../../gameframex/base/Singleton";

/** 玩家信息(与 luban/proto PlayerInfo 字段子集;完整结构由 proto 层透传) */
export interface PlayerInfoLite {
    Id: number;
    Name: string;
    Level: number;
}

export default class AccountManager extends Singleton<AccountManager>() {
    /** 登录账号 Id(ReqLogin 返回) */
    public AccountId: number = 0;

    /** 角色列表(ReqPlayerList 返回) */
    public PlayerList: PlayerInfoLite[] = [];

    /** 当前选择的角色 Id(进入游戏的目标) */
    public SelectedPlayerId: number = 0;
}
